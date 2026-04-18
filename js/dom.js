(function () {
  function appendChild(target, child) {
    if (child === null || child === undefined || child === false) {
      return;
    }

    if (Array.isArray(child)) {
      child.forEach(function (nestedChild) {
        appendChild(target, nestedChild);
      });
      return;
    }

    if (child && typeof child.nodeType === "number") {
      target.appendChild(child);
      return;
    }

    target.appendChild(document.createTextNode(String(child)));
  }

  function setAttribute(target, key, value) {
    if (value === null || value === undefined || value === false) {
      return;
    }

    if (/^on[A-Z]/.test(key) && typeof value === "function") {
      target.addEventListener(key.slice(2).toLowerCase(), value);
      return;
    }

    if (key === "className") {
      target.className = String(value);
      return;
    }

    if (key === "htmlFor") {
      target.htmlFor = String(value);
      return;
    }

    if (key === "dataset" && value && typeof value === "object") {
      Object.keys(value).forEach(function (dataKey) {
        target.dataset[dataKey] = String(value[dataKey]);
      });
      return;
    }

    if (key === "style" && value && typeof value === "object") {
      Object.assign(target.style, value);
      return;
    }

    if (value === true) {
      target.setAttribute(key, "");
      return;
    }

    target.setAttribute(key, String(value));
  }

  function h(tag, attrs) {
    var element = document.createElement(tag);
    var attributes = attrs && typeof attrs === "object" && !Array.isArray(attrs) && !(attrs.nodeType)
      ? attrs
      : null;
    var children = Array.prototype.slice.call(arguments, attributes ? 2 : 1);

    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        setAttribute(element, key, attributes[key]);
      });
    }

    children.forEach(function (child) {
      appendChild(element, child);
    });

    return element;
  }

  function fragment() {
    var node = document.createDocumentFragment();

    Array.prototype.slice.call(arguments).forEach(function (child) {
      appendChild(node, child);
    });

    return node;
  }

  window.NRDom = {
    h: h,
    fragment: fragment
  };
})();
