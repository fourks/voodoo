// ----------------------------------------------------------------------------
// File: MouseDetector.js
//
// Copyright (c) 2013 VoodooJs Authors
// ----------------------------------------------------------------------------



/**
 * The detector for mouse events.
 *
 * @constructor
 * @private
 *
 * @param {Engine} engine Voodoo main engine.
 */
function MouseDetector_(engine) {
  this.engine_ = engine;
  this.initState_();

  this.engine_.raycaster_.setMouse_(new Vector2_(0, 0));

  // Adds the main mouse event listeners.
  this.addGlobalMouseEventListeners_();

  var self = this;
  this.engine_['on']('removemodel', function(event) {
    if (self.hoveredTrigger_ && event['model'] === self.hoveredTrigger_.model_)
      self.hoveredTrigger_ = null;

    if (self.heldTrigger_) {
      for (var buttonIndex = 0; buttonIndex < 3; ++buttonIndex) {
        var trigger = self.heldTrigger_[buttonIndex];
        if (trigger && event['model'] === trigger.model_)
          self.heldTrigger_[buttonIndex] = null;
      }
    }

    if (self.lastClickedTrigger_) {
      for (var buttonIndex = 0; buttonIndex < 3; ++buttonIndex) {
        var trigger = self.lastClickedTrigger_[buttonIndex];
        if (trigger && event['model'] === trigger.model_)
          self.lastClickedTrigger_[buttonIndex] = null;
      }
    }
  });
}


/**
 * Registers document event listeners.
 *
 * @private
 */
MouseDetector_.prototype.addGlobalMouseEventListeners_ = function() {
  var self = this;

  document.addEventListener('mousemove', function(event) {
    self.onMouseMove_(event);
  }, false);

  document.addEventListener('mousedown', function(event) {
    self.onMouseDown_(event);
  }, false);

  document.addEventListener('mouseup', function(event) {
    self.onMouseUp_(event);
  }, false);
};


/**
 * Destroys the mouse event detector.
 *
 * @private
 * @this {MouseDetector_}
 */
MouseDetector_.prototype.destroy_ = function() {
  this.initState_();
  this.engine_ = null;
};


/**
 * Dispatches a mouse event to a model.
 *
 * @private
 *
 * @param {string} type Type of event.
 * @param {EventTrigger_} trigger Trigger.
 * @param {number=} opt_button Optional button code.
 * @param {EventTrigger_=} opt_target Optional target trigger.
 */
MouseDetector_.prototype.dispatchMouseEvent_ = function(
    type, trigger, opt_button, opt_target) {
  log_.assert_(trigger, 'trigger must not be null');

  var event = new window['voodoo']['Event'](type, trigger.model_,
      trigger.triggerId_);
  event.initializeMouseEvent_(this.clientX_, this.clientY_,
      this.lastHitX_, this.lastHitY_, this.lastHitZ_, opt_button);

  var target = opt_target || trigger;
  target.model_.dispatchEvent_(event);
};


/**
 * Initializes member variables for the first time
 *
 * @private
 */
MouseDetector_.prototype.initState_ = function() {
  /**
   * Trigger currently hovered over.
   *
   * @private
   * @type {EventTrigger_}
   */
  this.hoveredTrigger_ = null;

  /**
   * Trigger currently held down per button.
   *
   * @private
   * @type {Array.<EventTrigger_>}
   */
  this.heldTrigger_ = [null, null, null];

  /**
   * The last trigger clicked.
   *
   * @private
   * @type {Array.<EventTrigger_>}
   */
  this.lastClickedTrigger_ = [null, null, null];

  // Pending events
  this.pendingMouseMoveEvent_ = false;
  this.pendingDoubleClickEvent_ = [false, false, false];
  this.pendingMouseMove_ = false;

  // Mouse states
  this.clientX_ = 0;
  this.clientY_ = 0;
  this.lastHitX_ = 0;
  this.lastHitY_ = 0;
  this.lastHitZ_ = 0;

  // Click states per button
  this.lastClickTime_ = [null, null, null];
  this.lastClickClientX_ = [0, 0, 0];
  this.lastClickClientY_ = [0, 0, 0];
};


/**
 * Called when the user presses the mouse.
 *
 * @private
 *
 * @param {Event} event Event data.
 */
MouseDetector_.prototype.onMouseDown_ = function(event) {
  if (this.hoveredTrigger_ != null) {
    event.preventDefault();

    var lastClicked = this.lastClickedTrigger_[event.button];
    var interval = new Date() - this.lastClickTime_[event.button];
    this.heldTrigger_[event.button] = this.hoveredTrigger_;

    this.dispatchMouseEvent_('mousedown', this.hoveredTrigger_, event.button);

    // Detect a double click
    if (this.heldTrigger_[event.button].isEquivalentTo(lastClicked) &&
        this.lastClickClientX_[event.button] == event.clientX &&
        this.lastClickClientY_[event.button] == event.clientY &&
        interval <= this.engine_.options_.doubleClickInterval_) {

      this.pendingDoubleClickEvent_[event.button] = true;
    }
  }
};


/**
 * Updates the mouse coordinates and raycasters.
 *
 * @private
 *
 * @param {Event} event Event data.
 */
MouseDetector_.prototype.onMouseMove_ = function(event) {
  if (this.hoveredTrigger_ != null)
    event.preventDefault();

  this.clientX_ = event.clientX;
  this.clientY_ = event.clientY;
  this.pendingMouseMove_ = true;

  if (this.engine_.options_['realtime'])
    this.update_();
};


/**
 * Called when the user releases the mouse.
 *
 * @private
 *
 * @param {Event} event Event data.
 */
MouseDetector_.prototype.onMouseUp_ = function(event) {
  if (this.hoveredTrigger_ != null) {
    event.preventDefault();

    this.dispatchMouseEvent_('mouseup', this.hoveredTrigger_, event.button);

    var held = this.heldTrigger_[event.button];
    var lastClicked = this.lastClickedTrigger_[event.button];

    // Fire a mouseup event on the trigger that caused the mousedown
    if (held && this.hoveredTrigger_ != held)
      this.dispatchMouseEvent_('mouseup', this.hoveredTrigger_,
          event.button, held);

    // If the current trigger is the held trigger, this is a click.
    if (this.hoveredTrigger_.isEquivalentTo(held)) {

      this.dispatchMouseEvent_('click', this.heldTrigger_[event.button],
          event.button);

      // Send double clicks
      if (this.pendingDoubleClickEvent_[event.button] &&
          held.isEquivalentTo(lastClicked)) {

        this.lastClickedTrigger_[event.button] = null;
        this.pendingDoubleClickEvent_[event.button] = false;

        this.dispatchMouseEvent_('dblclick', held, event.button);
      }
      else {
        // Not a double click. Store the click info for later.
        this.lastClickedTrigger_[event.button] = held;
        this.lastClickTime_[event.button] = new Date();
        this.lastClickClientX_[event.button] = event.clientX;
        this.lastClickClientY_[event.button] = event.clientY;
      }
    }
  }

  this.heldTrigger_[event.button] = null;
};


/**
 * Casts a ray into the scene and returns the affected trigger.
 *
 * @private
 *
 * @return {EventTrigger_}
 */
MouseDetector_.prototype.raycast_ = function() {
  var raycastResult = this.engine_.raycaster_.raycast_();

  this.lastHitX_ = raycastResult.hitX;
  this.lastHitY_ = raycastResult.hitY;
  this.lastHitZ_ = raycastResult.hitZ;

  return raycastResult.trigger;
};


/**
 * Detects and dispatches model events.
 *
 * This is called each frame by the renderer.
 *
 * @private
 */
MouseDetector_.prototype.update_ = function() {
  // Whenever the mouse moves, we need to update the raycaster with the
  // new coordinates. We do this whenever the update runs
  // each frame instead of on mouse moves for performance.
  if (this.pendingMouseMove_)
    this.engine_.raycaster_.setMouse_(
        new Vector2_(this.clientX_, this.clientY_));

  // We raycast every frame because objects may be moving under the mouse.
  var nextTrigger = this.raycast_();

  if (nextTrigger != null) {
    // Mouse move events are only sent on update to boost performance
    if (this.pendingMouseMove_)
      this.dispatchMouseEvent_('mousemove', nextTrigger);

    if (!nextTrigger.isEquivalentTo(this.hoveredTrigger_)) {
      // Mouse leave the old trigger
      if (this.hoveredTrigger_ != null)
        this.dispatchMouseEvent_('mouseout', this.hoveredTrigger_);

      // Mouse enter the new trigger
      this.dispatchMouseEvent_('mouseover', nextTrigger);
    }

    this.engine_.renderer_.capturePointerEvents_(true);
  }
  else {
    // Mouse leave the old trigger
    if (this.hoveredTrigger_ != null)
      this.dispatchMouseEvent_('mouseout', this.hoveredTrigger_);

    this.engine_.renderer_.capturePointerEvents_(false);
  }

  this.hoveredTrigger_ = nextTrigger;
  this.pendingMouseMove_ = false;

  // Set the mouse cursor
  if (this.hoveredTrigger_ != null)
    this.engine_.renderer_.setCursor_(this.hoveredTrigger_.parent_.cursor_);
  else this.engine_.renderer_.setCursor_('auto');
};
