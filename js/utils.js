//
// auxiliary definitions
//

/**
 * bind function 'this'-reference (mostly so that we can register 
 * model object methods as view object event listeners, with
 * 'this' still referring to the model object)
 * NOTE: modern JS-implementations may already have this as a
 *       method (ES5)
 *  
 * @param f
 * @param x
 */
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

// opera does sequences of style.property=blah setters just fine;
// firefox (mostly) keeps the properties in the javascript object, 
// but uses only the last one set for actual css styling, 
// so we regroup the properties into a single setAttribute
//
// TODO: we're still sometimes losing style attributes in firefox
//       ('esc' might lose placeCursor attributes, then 'p' gives 
//       black cursor - when this happens, the individual style 
//       attributes of the javascript object are also gone?)
// ==> we now try to use object attributes instead of style properties,
//     replacing x.style.prop= with x.setAttributeNS(null,'prop',)
//     where possible (eg, where svg attributes overlap css properties)
// TODO: instead of patching after modification, which is ugly and easy to
//       forget provide a patching modification operation (which, for opera,
//       could simply modify the style attributes but, for firefox, needs to
//       do some string munging on cssText..
function patchStyle(x) {
  var cssvals = ['cursor','display'];
  var jsvals  = ['cursor','display'];
  var style   = [];
  for (var i in cssvals) {
    var cssval = cssvals[i];
    var jsval  = jsvals[i];
    if (x.style[jsval]) style.push(cssval+': '+x.style[jsval]);
  }
  // listProperties('x.style'+(x.id?'('+x.id+'): ':': '),x.style);
  // message('patchStyle'+(x.id?'('+x.id+'): ':': ')+style.join('; '));
  x.style.cssText = style.join('; ');
}


