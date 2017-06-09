(function (factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    window.Slit = factory();
  }
})(function () {
  'use strict';
  function assert(condition) {
    if (!condition) {
      throw Error('AssertionError: Invalid arguments');
    }
  }

  function uuid() {
    var result = [];
    for (var i = 0; i < 3; i++) {
      result.push(Math.floor(Math.random() * 10000000).toString(32));
    }
    return result.join('-');
  }

  Element.prototype.matches =
    Element.prototype.matchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.msMatchesSelector ||
    Element.prototype.oMatchesSelector ||
    Element.prototype.webkitMatchesSelector;

  /**
   * @exports Slit
   * Create a Slit instance
   * @param {{ menu: Element, panel: Element, side: string, margin: number }} options
   */
  function Slit(options) {
    assert(options.menu instanceof Element);
    assert(options.panel instanceof Element);
    assert(!options.side || options.side === 'left' || options.side === 'right');
    assert(!options.type || options.type === 'drawer' || options.type === 'reveal');
    assert(!options.margin || isFinite(options.margin));
    assert(!options.timing || isFinite(options.timing));
    assert(!options.width || isFinite(options.width));

    var html = document.documentElement;

    var slit = {
      /**
       * @type {Element}
       * the element which contains your menu
       */
      menu: options.menu,
      /**
       * @type {Element}
       * the element containing your site's main content
       */
      panel: options.panel,
      /**
       * @type {string}
       * the side of the screen it should show on
       */
      side: options.side || 'left',
      /**
       * @type {string}
       * whether the menu should open over the panel ('drawer')
       * or the panel should be moved to reveal the menu ('reveal')
       */
      type: options.type || 'drawer',
      /**
       * @type {number}
       * the number of pixels in which a touch event will be accepted
       */
      margin: options.margin || 10,
      /**
       * @type {number}
       * milliseconds of the transition animation for opening and closing
       */
      timing: options.timing || 200,
      /**
       * @type {number}
       * width of menu in pixels
       */
      width: options.width || 256,

      /**
       * @type {{ [key: string]: Function[] }}
       */
      _handlers: {
        beforeclose: [],
        closed: [],
        beforeopen: [],
        opened: [],
        touchstart: [],
        touchmove: [],
        touchend: [],
      },
      /**
       * Trigger event emitters for the event
       * @private
       * @param {string} eventName
       * @param {Event} e
       */
      _trigger: function (eventName, e) {
        var self = this;
        self._handlers[eventName].forEach(function (handler) {
          handler.call(self, e);
        });
      },
      /**
       * Add an event handler
       * @param {string} eventName
       * @param {Function} handler
       */
      on: function (eventName, handler) {
        this._handlers[eventName].push(handler);
      },
      /**
       * Remove all event handlers for an event
       * @param {string} eventName
       */
      off: function (eventName) {
        this._handlers[eventName] = [];
      },

      opened: false,
      opening: false,
      closed: true,
      closing: false,

      /**
       * Close this menu
       */
      close: function () {
        var self = this;

        self._trigger('beforeclose');
        if (self._disabled) {
          return;
        }

        self.menu.style[self.side] = null;
        self.panel.style.transform = null;

        if (self.opened || self.opening) {
          clearTimeout(self._timer);

          self.menu.classList.remove('open');
          self.opened = false;
          self.opening = false;
          self.closed = false;
          self.closing = true;

          self._timer = setTimeout(function () {
            self.closing = false;
            self.closed = true;

            html.classList.remove('slit-open');
            html.classList.remove('slit-open-' + self._id);
            self._trigger('closed');
          }, self.timing);
        }
      },
      /**
       * Open this menu
       */
      open: function () {
        var self = this;

        self._trigger('beforeopen');
        if (self._disabled) {
          return;
        }

        self.menu.style[self.side] = null;
        self.panel.style.transform = null;

        if (self.closed || self.closing) {
          clearTimeout(self._timer);

          self.menu.classList.add('open');
          self.closed = false;
          self.closing = false;
          self.opened = false;
          self.opening = true;

          self._timer = setTimeout(function () {
            self.opening = false;
            self.opened = true;

            self._trigger('opened');
            html.classList.add('slit-open');
            html.classList.add('slit-open-' + self._id);
          }, self.timing);
        }
      },
      /**
       * Toggle the state of the menu
       * @param {boolean} [condition] - `true` for open, `false` for close
       */
      toggle: function (condition) {
        if (condition === true) {
          this.open();
        } else if (condition === false) {
          this.close();
        } else {
          this.toggle(this.closed || this.closing);
        }
      },

      /** @type {string[]} */
      _ignores: [],
      /**
       * Ignore touch events from elements matching a given selector
       * @param {string} selector
       */
      ignore: function (selector) {
        this._ignores.push(selector);
      },

      _disabled: false,

      /**
       * Disable this menu
       */
      disable: function () {
        this._disabled = true;
      },
      /**
       * Enable this menu
       */
      enable: function () {
        this._disabled = false;
      },

      _touched: false,
      _menuStyle: getComputedStyle(options.menu),
      _panelStyle: getComputedStyle(options.panel),
      _offset: function () {
        if (this.type === 'drawer') {
          return parseFloat(this._menuStyle[this.side].match(/-?(\d+)px/)[1], 10);
        } else {
          var offset = this._panelStyle.transform.match(/matrix\((.*)\)/);
          offset = offset && offset[1] && offset[1].split(', ')[4];
          offset = offset ? Math.abs(parseFloat(offset, 10)) : 0;
          return this.width - offset;
        }
      },
      _startOffset: 0,
      _startX: 0,

      _id: uuid(),
      _init: function () {
        var self = this;

        /** @type {Element} */
        var menu = self.menu;
        /** @type {Element} */
        var panel = self.panel;

        // setup CSS styles
        menu.classList.add('slit');
        menu.classList.add('slit-' + self._id);

        panel.classList.add('slit-panel');
        panel.classList.add('slit-panel-' + self._id);

        var styleElem = document.getElementById('slit-styles');
        if (!styleElem) {
          document.head.insertAdjacentHTML('beforeend',
            '<style id="slit-styles">' +
            '.slit { position: fixed; top: 0; bottom: 0; left: auto; right: auto; }' +
            '</style>'
          );
          styleElem = document.getElementById('slit-styles');
        }

        var style = '.slit-' + self._id + ' { transition: ' + self.side + ' ' + self.timing + 'ms; width: ' + self.width + 'px; ';
        if (self.type === 'drawer') {
          style += self.side + ': ' + -self.width + 'px; z-index: 10000; } .slit-' + self._id + '.open { ' + self.side + ': 0; }';
        } else {
          style += self.side + ': 0; } .slit-' + self._id + '.open ~ .slit-panel-' + self._id +
            ' { transform: translateX(' + (self.side === 'left' ? '' : '-') + self.width + 'px); } ' +
            '.slit-panel-' + self._id + ' { transform: translateX(0); transition: transform ' + self.timing + 'ms; }';
        }
        styleElem.insertAdjacentHTML('beforeend', style);

        // setup events

        /** @param {TouchEvent} e */
        function onTouchstart(e) {
          var ignores = self._ignores.join(', ');
          if (ignores && e.target.matches(ignores)) {
            return;
          }
          self._trigger('touchstart', e);
          if (self._disabled) {
            return;
          }
          if (self.closed) {
            self._trigger('beforeopen');
          } else if (self.opened) {
            self._trigger('beforeclose');
          }

          self._touched = false;
          if (e.touches.length === 1) {
            var touch = e.touches[0];
            var offset = self._offset();
            var margin = self.margin + self.width - offset;
            if (self.side === 'left' && touch.clientX <= margin ||
                self.side === 'right' && window.innerWidth - touch.clientX <= margin) {
              self._touched = true;
              self._startX = touch.clientX;
              self._startOffset = offset;
              menu.style.transition = 'none';
              panel.style.transition = 'none';
            }
          }
        }

        var lastOffset = self.width;

        /** @param {TouchEvent} e */
        function onTouchmove(e) {
          self._trigger('touchmove', e);
          if (self._disabled || !self._touched) {
            return;
          }

          var touch = e.touches[0];
          var diff = (self.side === 'left' ? -1 : 1) * (touch.clientX - self._startX);
          var offset = Math.min(Math.max(0, self._startOffset + diff), self.width);
          if (self.type === 'drawer') {
            menu.style[self.side] = -offset + 'px';
          } else {
            panel.style.transform = 'translateX(' + (self.side === 'left' ? '' : '-') + (self.width - offset) + 'px)';
          }
          lastOffset = offset;
        }

        /** @param {TouchEvent} e */
        function onTouchend(e) {
          if (!self._touched) {
            return;
          }
          self._trigger('touchend', e);

          var offset = lastOffset;
          if (offset > self.width * 2 / 3) {
            self.close();
          } else {
            self.open();
          }
          menu.style.transition = null;
          panel.style.transition = null;
        }

        html.addEventListener('touchstart', onTouchstart, false);
        html.addEventListener('touchmove', onTouchmove, false);
        html.addEventListener('touchend', onTouchend, false);
      },
    };

    slit._init();

    return slit;
  }

  return Slit;
});