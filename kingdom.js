'use strict';

var imageCache = {};

const supportHTML = (function () {
    if (!window.DOMParser) return false;
    var parser = new DOMParser();
    try { parser.parseFromString('x', 'text/html'); }
    catch (err) { return false; }
    return true;
});
const getHTML = function (str) {
    if (supportHTML()) { return new DOMParser().parseFromString(str, 'text/html').body; }
    else if (typeof document !== 'undefined') {
        var dom = document.createElement('div');
        dom.innerHTML = str;
        return dom;
    }
    else { return {}; }
};
const removeEmptyDivSpan = function (html) {
    if (html.indexOf('></') > -1) { html = html.replace(/<div><\/div>/g, '').replace(/<span><\/span>/g, ''); }
    return html;
};
const getHTMLValue = function (html) {
    if (typeof html === 'string') { return removeEmptyDivSpan(html); }
    else {
        var elem = null;
        if (typeof document !== 'undefined') {
        	try { elem = document.querySelector(html); }
        	catch (e) { elem = null; }
        }
        return elem && 'innerHTML' in elem ? removeEmptyDivSpan(elem.innerHTML) : '';
    }
};
const diffElem = function (templateMap, domMap, elem) {
    var count = domMap.length - templateMap.length;
    if (count > 0) {
        while (count > 0) {
            try { domMap[domMap.length - count].node.parentNode.removeChild(domMap[domMap.length - count].node); }
            catch (e) { }
            count--;
        }
    }
    templateMap.forEach(function (node, index) {
        if (!domMap[index]) {
            elem.appendChild(addElem(templateMap[index]));
            return;
        }
        if (templateMap[index].type !== domMap[index].type) {
            domMap[index].node.parentNode.replaceChild(addElem(templateMap[index]), domMap[index].node);
            return;
        }
        diffAttributes(templateMap[index], domMap[index]);
        if (templateMap[index].content !== domMap[index].content) { domMap[index].node.textContent = templateMap[index].content; }
        if (domMap[index].children.length > 0 && node.children.length < 1) {
            domMap[index].node.innerHTML = '';
            return;
        }
        if (domMap[index].children.length < 1 && node.children.length > 0) {
            var fragment = document.createDocumentFragment();
            diffElem(node.children, domMap[index].children, fragment);
            elem.appendChild(fragment);
            return;
        }
        if (node.children.length > 0) { diffElem(node.children, domMap[index].children, domMap[index].node); }
    });
};
const removeEmptyElem = function (element) {
    var removeNodes = [];
    var node = null;
    for (var i = 0; i < element.childNodes.length; i++) {
        node = element.childNodes[i];
        try {
            if ("attributes" in node && node.attributes.length == 0) {
                if ("childNodes" in node && node.childNodes.length > 0) { }
                else if (node.nodeType == 1 && "innerText" in node && node.innerText.length == 0) { removeNodes.push(node); }
                else if ("innerHTML" in node && node.innerHTML.length == 0) { removeNodes.push(node); }
            }
        }
        catch (e) { }
    }
    if (removeNodes.length > 0) {
        for (var j = 0; j < removeNodes.length; j++) { removeNodes[j].parentNode.removeChild(removeNodes[j]); }
    }
};
const getElem = function (element, removeEmpty, isSVG) {
    if (removeEmpty) { removeEmptyElem(element); }
    return Array.prototype.map.call(element.childNodes, (function (node) {
        var details = {
            content: node.childNodes && node.childNodes.length > 0 ? null : node.textContent,
            atts: node.nodeType !== 1 ? [] : getAttributes(node.attributes),
            type: node.nodeType === 3 ? 'text' : (node.nodeType === 8 ? 'comment' : node.tagName.toLowerCase()),
            node: node
        };
        details.isSVG = isSVG || details.type === 'svg';
        details.children = getElem(node, false, details.isSVG);
        return details;
    }));
};
const addElem = function (elem) {
    var node = null;
    if (elem.type === 'text') { node = document.createTextNode(elem.content); }
    else if (elem.type === 'comment') { node = document.createComment(elem.content); }
    else if (elem.isSVG) { node = document.createElementNS('http://www.w3.org/2000/svg', elem.type); }
    else { node = document.createElement(elem.type); }
    addAttributes(node, elem.atts);
    if (elem.children.length > 0) {
        elem.children.forEach(function (childElem) { node.appendChild(addElem(childElem)); });
    }
    else if (elem.type !== 'text') { node.textContent = elem.content; }
    return node;
};
const getStyles = function (styles) {
    return styles.split(';').reduce(function (arr, style) {
        if (style.trim().indexOf(':') > 0) {
            var styleArr = style.split(':');
            arr.push({ name: styleArr[0] ? styleArr[0].trim() : '', value: styleArr[1] ? styleArr[1].trim() : '' });
        }
        return arr;
    }, []);
};
const removeStyles = function (elem, styles) {
    styles.forEach(function (style) {
        elem.style[style] = '';
    });
};
const addStyles = function (elem, styles) {
    styles.forEach(function (style) {
        var ret = false;
        try { ret = window.getComputedStyle(elem).getPropertyValue(style.name) !== style.value; }
        catch (e) { ret = true; }
        if (ret) { elem.style[style.name] = style.value; }
    });
};
const diffStyles = function (elem, styles) {
    var styleMap = getStyles(styles);
    var remove = Array.prototype.filter.call(elem.style, function (style) {
        var findStyle = styleMap.find(function (newStyle) { return newStyle.name === style && newStyle.value === elem.style[style]; });
        return findStyle === undefined;
    });
    removeStyles(elem, remove);
    addStyles(elem, styleMap);
};
const getImage = function (elem) {
    elem.style.opacity = 1;
    elem.removeEventListener('load', function () { getImage(elem); });
};
const getAttributes = function (attributes) {
    return Array.prototype.map.call(attributes, function (attribute) {
        return { att: attribute.name, value: attribute.value };
    });
};
const removeAttributes = function (elem, atts) {
    atts.forEach(function (attribute) {
        try {
            if (attribute.att === 'class') { elem.className = ''; }
            else if (attribute.att === 'style') { removeStyles(elem, Array.prototype.slice.call(elem.style)); }
            else { elem.removeAttribute(attribute.att); }
        }
        catch (e) { console.log(e); }
    });
};
const addAttributes = function (elem, atts) {
    var classAdd = [];
    var classRemove = [];
    var attrAdd = {};
    var stylesAdd = {};
    atts.forEach(function (attribute) {
        if (attribute.att.length > 0 && attribute.att.indexOf('=') == -1) {
            var ret = false;
            try {
                if (attribute.att === 'class') {
                    try { ret = elem.className !== attribute.value; }
                    catch (e) { ret = true; }
                    if (ret) {
                        try { elem.className = attribute.value; }
                        catch (e) { elem.setAttribute('class', attribute.value); }
                    }
                }
                else if (attribute.att === 'style') { diffStyles(elem, attribute.value); }
                else if (attribute.att == 'src') {
                    var src = '';
                    try { src = String(attribute.value).replace(/ /g, '%20'); }
                    catch (e) { src = attribute.value; }
                    try { ret = elem.getAttribute('src') !== src; }
                    catch (e) { ret = true; }
                    if (ret) {
                        if (src != null && src.length > 0 && src in imageCache) {
                            stylesAdd.opacity = 0.25;
                            attrAdd.src = src;
                            elem.addEventListener('load', function () { getImage(elem); });
                        }
                        else if (src.toLowerCase().indexOf('.svg') > -1) {
                            attrAdd.src = src;
                            imageCache[src] = true;
                        }
                        else {
                            elem.removeAttribute('src');
                            stylesAdd.opacity = 1;
                            attrAdd['data-src'] = src;
                            setTimeout(() => {
                                if (elem.getAttribute('data-src') === src) {
                                    elem.setAttribute('src', src);
                                    elem.removeAttribute('data-src');
                                }
                            }, 10);
                            imageCache[src] = true;
                        }
                    }
                }
                else {
                    try { ret = elem.getAttribute(attribute.att) !== attribute.value; }
                    catch (e) { ret = true; }
                    if (ret) {
                        if (typeof attribute.value === 'string') { elem.setAttribute(attribute.att, attribute.value); }
                        else { elem.setAttribute(attribute.att, attribute.value || true); }
                    }
                }
            }
            catch (e) { console.log(e); }
        }
    });
    if (classRemove.length > 0) {
        for (var i = 0; i < classRemove.length; i++) { elem.classList.remove(classRemove[i]); }
    }
    if (classAdd.length > 0) {
        for (var j = 0; j < classAdd.length; j++) { elem.classList.add(classAdd[j]); }
    }
    if (Object.keys(attrAdd).length > 0) {
        for (var attr in attrAdd) { elem.setAttribute(attr, attrAdd[attr]); }
    }
    if (Object.keys(stylesAdd).length > 0) {
        for (var style in stylesAdd) { elem.style.setProperty(style, stylesAdd[style]); }
    }
};
const diffAttributes = function (template, existing) {
    var remove = existing.atts.filter(function (att) {
        var getAtt = template.atts.find(function (newAtt) { return att.att === newAtt.att; });
        return getAtt === undefined;
    });
    var change = template.atts.filter(function (att) {
        var getAtt = find(existing.atts, function (existingAtt) { return att.att === existingAtt.att; });
        return getAtt === undefined || getAtt.value !== att.value;
    });
    removeAttributes(existing.node, remove);
    addAttributes(existing.node, change);
};
const render = function (id, html) {
    var app = typeof id === 'string' ? document.querySelector(id) : id;
    var templateMap = typeof html === 'object' ? html : parseHTML(html);
    var domMap = getElem(app, true);
    diffElem(templateMap, domMap, app);
};
const parseHTML = function (html) { return getElem(getHTML(getHTMLValue(html))); };

var kingDOMProto = function (id, html) {
    render(id, html);
    return this;
};
var kingDOMCore = kingDOMProto.prototype;
if (typeof window !== 'undefined') { window.$html = (id, html) => new kingDOMProto(id, html); }
else if (typeof module !== 'undefined') { module.exports = kingDOMCore; }
