
/**
 * PlayerModeReplay :: This module governs the "replay" mode of the player, e.g. traversing through an
 * existing game record without the ability to deviate from the tree or its variations.
 */

/**
 * Module definition and dependencies
 */
angular.module('ngGo.Player.Mode.Replay.Service', [
	'ngGo',
	'ngGo.Game.Scorer.Service'
])

/**
 * Extend player functionality and register the mode
 */
.run(function($interval, Player, PlayerModes, PlayerModeReplay) {

	/**
	 * Register event handlers
	 */
	Player.on('settingChange', PlayerModeReplay.settingChange, PlayerModes.REPLAY);
	Player.on('boardUpdate', PlayerModeReplay.boardUpdate, PlayerModes.REPLAY);
	Player.on('modeEnter', PlayerModeReplay.modeEnter, PlayerModes.REPLAY);
	Player.on('modeExit', PlayerModeReplay.modeExit, PlayerModes.REPLAY);
	Player.on('keydown', PlayerModeReplay.keyDown, PlayerModes.REPLAY);
	Player.on('click', PlayerModeReplay.click, PlayerModes.REPLAY);
	Player.on('hover', PlayerModeReplay.hover, PlayerModes.REPLAY);

	/**
	 * Set replay auto play delay
	 */
	Player.setReplayAutoPlayDelay = function(delay) {
		if (this.replayAutoPlayDelay != delay) {
			this.replayAutoPlayDelay = delay;
			this.broadcast('settingChange', 'replayAutoPlayDelay');
		}
	};

	/**
	 * Start auto play with a given delay
	 */
	Player.start = function(delay) {

		//No game or no move children?
		if (!this.game || !this.game.node.hasChildren()) {
			return;
		}

		//Get self
		var self = this;

		//Determine delay
		delay = (typeof delay == 'number') ? delay*1000 : this.replayAutoPlayDelay;

		//Create interval
		this.replayAutoPlayPromise = $interval(function() {

			//Advance to the next node
			self.next();

			//Ran out of children?
			if (!self.game.node.hasChildren()) {
				self.stop();
			}
		}, delay);
	};

	/**
	 * Cancel auto play
	 */
	Player.stop = function() {
		if (this.replayAutoPlayPromise) {
			$interval.cancel(this.replayAutoPlayPromise);
			this.replayAutoPlayPromise = null;
		}
	};

	//Auto play vars
	Player.replayAutoPlayDelay = 1000;
	Player.replayAutoPlayPromise = null;

	//Register the mode
	Player.registerMode(PlayerModes.REPLAY, PlayerModeReplay);
})

/**
 * Provider definition
 */
.provider('PlayerModeReplay', function() {

	/**
	 * Default configuration
	 */
	var defaultConfig = {

		//Auto play delay
		replay_auto_play_delay: 1000
	};

	/**
	 * Set global default configuration for players
	 */
	this.setConfig = function(config) {
		defaultConfig = angular.extend(defaultConfig, config);
	};

	/**
	 * Service getter
	 */
	this.$get = function(Player, PlayerTools, MarkupTypes, GameScorer) {

		/**
		 * Helper to update the hover mark
		 */
		var updateHoverMark = function(x, y) {

			//Falling outside of grid?
			if (!this.board.isOnBoard(x, y)) {
				return;
			}

			//What happens, depends on the active tool
			switch (this.tool) {

				//Move tool
				case PlayerTools.MOVE:

					//Hovering over empty spot where we can make a move?
					if (!this.game.hasStone(x, y) && this.game.isMoveVariation(x, y)) {
						this.board.add('hover', x, y, {
							type: 'stones',
							value: this.game.getTurn()
						});
					}
					break;

				//Score tool
				case PlayerTools.SCORE:

					//Hovering over a stone means it can be marked dead or alive
					if (this.game.hasStone(x, y)) {
						this.board.add('hover', x, y, {
							type: 'markup',
							value: MarkupTypes.MARK
						});
					}
					break;
			}
		};

		/**
		 * Helper to show move variations on the board
		 */
		var showMoveVariations = function(variations) {
			for (var i = 0; i < variations.length; i++) {

				//Auto variation markup should never overwrite existing markup
				if (this.board.has('markup', variations[i].move.x, variations[i].move.y)) {
					continue;
				}

				//Add to board
				this.board.add('markup', variations[i].move.x, variations[i].move.y, {
					type: this.board.theme.get('markup.variation.type'),
					text: this.board.theme.get('markup.variation.text', i),
					color: this.board.theme.get('markup.variation.color')
				});
			}
		};

		/**
		 * Helper to hide move variations from the board
		 */
		var hideMoveVariations = function(variations) {
			for (var i = 0; i < variations.length; i++) {
				this.board.remove('markup', variations[i].move.x, variations[i].move.y);
			}
		};

		/**
		 * Draw (or clear) move variations on the board
		 */
		var drawMoveVariations = function(show) {

			//Check if we can do something
			if (!this.board || !this.game || !this.game.isLoaded()) {
				return;
			}

			//Get the current node
			var node = this.game.getNode(), variations;
			if (!node) {
				return;
			}

			//Child variations?
			if (this.variationChildren && node.hasMoveVariations()) {
				variations = node.getMoveVariations();
				if (show) {
					showMoveVariations.call(this, variations);
				}
				else {
					hideMoveVariations.call(this, variations);
				}
			}

			//Sibling variations?
			if (this.variationSiblings && node.parent && node.parent.hasMoveVariations()) {
				variations = node.parent.getMoveVariations();
				if (show) {
					showMoveVariations.call(this, variations);
				}
				else {
					hideMoveVariations.call(this, variations);
				}
			}
		};

		/**
		 * Player mode definition
		 */
		var PlayerModeReplay = {

			/**
			 * Parse config instructions
			 */
			parseConfig: function(config) {

				//Validate
				if (typeof config != 'object') {
					return;
				}

				//Extend from default config
				this.config = angular.extend({}, this.config, defaultConfig, config);

				//Process settings
				this.setReplayAutoPlayDelay(this.config.replay_auto_play_delay);
			},

			/**
			 * Setting changes handler
			 */
			settingChange: function(event, setting) {

				//Solution paths setting changes?
				if (setting == 'variationMarkup') {
					drawMoveVariations.call(this, this.variationMarkup);
				}
			},

			/**
			 * Hover handler
			 */
			hover: function(event) {
				this.board.removeAll('hover');
				updateHoverMark.call(this, event.x, event.y);
			},

			/**
			 * Board update event handler
			 */
			boardUpdate: function(event, node) {

				//Show move variations
				if (this.variationMarkup) {
					drawMoveVariations.call(this, true);
				}
			},

			/**
			 * Handler for keydown events
			 */
			keyDown: function(event, keyboardEvent) {

				//Update hover mark
				this.board.removeAll('hover');
				updateHoverMark.call(this, this.lastX, this.lastY);
			},

			/**
			 * Handler for mouse click events
			 */
			click: function(event, mouseEvent) {

				//Falling outside of grid?
				if (!this.board.isOnBoard(event.x, event.y)) {
					return;
				}

				//What happens, depends on the active tool
				switch (this.tool) {

					//Move tool
					case PlayerTools.MOVE:

						//Check if we clicked a move variation, advance to the next position if so
						if (this.game.isMoveVariation(event.x, event.y)) {
							this.next(this.game.getMoveVariation(event.x, event.y));
						}
						break;

					//Score tool, mark stones dead or alive
					case PlayerTools.SCORE:

						//Mark the clicked item and score the current game position
						GameScorer.mark(event.x, event.y);
						this.scoreGame();
						break;
				}

				//Handle hover
				PlayerModeReplay.hover.call(this, event);
			},

			/**
			 * Handler for mode entry
			 */
			modeEnter: function(event) {

				//Set available tools for this mode
				this.setTools([
					PlayerTools.MOVE,
					PlayerTools.SCORE
				]);

				//Set default tool
				this.tool = this.tools[0];

				//Show move variations
				if (this.variationMarkup) {
					drawMoveVariations.call(this, true);
				}
			},

			/**
			 * Handler for mode exit
			 */
			modeExit: function(event) {

				//Hide move variations
				if (this.variationMarkup) {
					drawMoveVariations.call(this, false);
				}
			}
		};

		//Return
		return PlayerModeReplay;
	};
});