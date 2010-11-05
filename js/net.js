//
// main Net object container (holds model objects and svg canvas) and its Cursor
// object (holds Cursor mode and its visual representation)
//

// dependency: vector.js
// dependency: net-elements.js
// dependency: utils.js

var svgNS = 'http://www.w3.org/2000/svg';

// ----------------------------- Cursor {{{

/**
 * a Cursor belongs to a host net; it tracks and visualizes a Cursor mode, which
 * determines mode-specific event handler actions in that net (such as
 * creating/moving/deleting Nodes/Arcs); (note: we use predefined CSS cursor
 * shapes, where that makes sense, but render SVG shapes for cursor mode
 * visualization directly instead of going via the official cursor element)
 * 
 * @param net
 */
function Cursor(net) {
  this.net = net;
  this.pos = new Pos(0,0);

  var tWidth  = this.net.transitionWidth/5;
  var tHeight = this.net.transitionHeight/5;
  var r       = this.net.r/5;
  var offset  = this.net.r;

  // for custom cursors, we add the active shape to the palette
  this.palette = document.createElementNS(svgNS,'g');
  this.palette.id = 'cursorPalette';
  this.mode    = ''; // TODO: - an enum would be nicer
                     //       - can we replace the various switch/if on
                     //         mode with a nice oo pattern without
                     //         obfuscating the code?
                     //       - at least use abstract mode getters..

  this.transition  = Transition.prototype.transitionShape('transitionCursor'
                                                         ,offset,-offset
                                                         ,tWidth,tHeight);

  this.place  = Place.prototype.placeShape('placeCursor',offset,-offset,r);
}

/**
 * hide all Cursor shapes
 */
Cursor.prototype.hideAll = function () {
  if (this.palette.firstChild)
    this.palette.removeChild(this.palette.firstChild);
  this.net.svg.style.cursor = 'auto';
}

/**
 * set 'default' Cursor
 */
Cursor.prototype.defaultCursor = function () {
  this.hideAll();
}

/**
 * set 'delete' Cursor, to delete elements
 */
Cursor.prototype.deleteCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'crosshair';
}

/**
 * set 'move' Cursor, to move elements
 */
Cursor.prototype.moveCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'move';
}

/**
 * set 'transition' Cursor, to create Transitions
 */
Cursor.prototype.transitionCursor = function () {
  this.hideAll();
  this.palette.appendChild(this.transition);
}

/**
 * set 'place' Cursor, to create Places
 */
Cursor.prototype.placeCursor = function () {
  this.hideAll();
  this.palette.appendChild(this.place);
}

/**
 * Cursor supports connectorFor interface, so that partially constructed arcs
 * can simply be connected to the Cursor while under construction
 * 
 * @param pos
 */
Cursor.prototype.connectorFor = function(pos) {
  return this.pos;
}

/**
 * update the Cursor position (usually called from mousemove handler)
 * 
 * @param p
 */
Cursor.prototype.updatePos = function(p) {
  this.palette.setAttributeNS(null,'transform','translate('+p.x+','+p.y+')');
  this.pos.x = p.x;
  this.pos.y = p.y;
}

// ----------------------------- }}}

// ----------------------------- Net {{{

/**
 * a Net has an id, an SVG rendering (with viewBox dimensions width and height);
 * it has lists of transitions, places and arcs, as well as a current selection;
 * its view is grouped into "real" contents (the transition, place, and arc
 * views) and "extra" stuff (backdrop, definitions, cursor, help text); it
 * reacts to click, mousemove, and keypress events (the latter are currently
 * captured at the surrounding document level)
 * 
 * @param id
 * @param width
 * @param height
 */
function Net(id,width,height) {

  this.id     = id;
  this.svgDiv = document.createElement('div');
  this.svgDiv.id = 'svgDiv';
  this.svgDiv.setAttribute('style','margin: 10px; background: lightgrey');
  this.svg    = elementNS(svgNS,'svg'
                         ,{'version':'1.1'
                          ,'width':'100%'
                          ,'height':'10cm'
                          });
  this.svg.id = id;
  this.svgDiv.appendChild(this.svg);

  // opera doesn't register mousemove events where there is no svg content,
  // so we provide a dummy backdrop (this doesn't seem needed in firefox?)
  // TODO: does the standard say anything about this?
  this.addBackdrop();

  this.setViewSize(0,0,width,height);

  this.addDefs();

  this.cursor      = new Cursor(this);
  this.svg.appendChild(this.cursor.palette);

  // put "real" contents such as nodes and arcs into their own group, to keep
  // them separate from administrative stuff such as backdrop, cursor, defs
  // (also helps with computing bounding boxes)
  this.contents = elementNS(svgNS,'g',{'id':'contents'});
  this.svg.appendChild(this.contents);

  // TODO: maintain separate groups for places/transitions/arcs and labels,
  //       to ensure that labels are never overlapped by other elements

  this.svg.net = this;
  this.clicks = 0;

  // some browsers won't call these svg event listeners
  // opera 10.51: ok; firefox 3.6.10: ok; safari 5.0: no
  // this.svg.addEventListener('click',bind(this.clickHandler,this),false);
  // this.svg.addEventListener('mousemove',bind(this.mousemoveHandler,this),false);
  this.svgDiv.addEventListener('click',bind(this.clickHandler,this),false);
  this.svgDiv.addEventListener('mousemove',bind(this.mousemoveHandler,this),false);

  // can't listen for keypress on svg only?
  // opera 10.51: ok; firefox 3.6.2: no
  // this.svg.addEventListener('keypress',function(e){ message('keypress'); },false);
  // this.svg.addEventListener('keydown',function(e){ message('keydown'); },false);
  document.documentElement.addEventListener('keypress'
                                           ,bind(this.keypressHandler,this)
                                           ,false);

  this.places      = [];
  this.transitions = [];
  this.arcs        = [];
  this.selection   = null;

  this.addHelp();
}
Net.prototype.toString = function() {
  var r = '';
  r += this.id+"\n";
  r += "places: ";
  for (var k in this.places) r += '['+k+"="+this.places[k]+']';
  r += "\ntransitions: ";
  for (var k in this.transitions) r += '['+k+"="+this.transitions[k]+']';
  r += "\narcs: ";
  for (var k in this.arcs) r +=  '['+this.arcs[k].source.id
                               +'->'+this.arcs[k].target.id+']';
  return r;
}

// TODO: asymmetric transition shape would be preferred, to avoid
//        impressions of duration, but that calls for rotation ability
/**
 * default node dimensions 
 */
Net.prototype.r                     = 10;
Net.prototype.transitionWidth       = 2*Net.prototype.r;
Net.prototype.transitionHeight      = 2*Net.prototype.r;

// TODO: properly calculate clip and backdrop dimensions
//       read svg viewport spec again, viewBox, viewport and aspect..
//       how to calculate the visible x/y-coordinates automatically and portably?
//
//       we need to do this in two stages? initially, when the svg gets
//       added to the document, there is some browser/element-negotiation
//       about initial viewport; so we need to post the viewport coordinates
//       we want, then check what viewport coordinates we got (and probably
//       do the same for any later resizing - look for resize-related events);
//
//       for now, we embed the svg in a div and use the div's client..
//       properties, side-stepping the issues
//
/**
 * set viewBox, clipBox, and backdrop dimensions
 * 
 * @param x
 * @param y
 * @param w
 * @param h
 */
Net.prototype.setViewSize = function (x,y,w,h) {
  this.width  = w;
  this.height = h;
  setAttributesNS(this.svg,{'viewBox': x+' '+y+' '+w+' '+h
                           ,'clip': y+' '+w+' '+h+' '+x}); // TODO: is this right?
  this.updateBackdrop();
}

/**
 * add backdrop (to capture events in the absence of other SVG elements)
 */
Net.prototype.addBackdrop = function () {
  this.svgBackdrop = elementNS(svgNS,'rect'
                              ,{'id':'svgBackdrop'
                               ,'fill':'lightgrey'
                               });
  this.updateBackdrop();
  this.svg.appendChild(this.svgBackdrop);
}

Net.prototype.updateBackdrop = function () {
  var boundingRect = this.svgDiv;
  setAttributesNS(this.svgBackdrop,{'x': boundingRect.clientLeft
                                   ,'y': boundingRect.clientTop
                                   ,'width': boundingRect.clientWidth
                                   ,'height': boundingRect.clientHeight});
}

/**
 * add help text (visibility can be toggled by pressing '?')
 */
// TODO: - alternative key bindings: t/p modelessly create nodes, a
//          starts/splits/ends arcs
// note: future versions will use keybindings differently
Net.prototype.addHelp = function () {
  this.help = elementNS(svgNS,'text'
                       ,{'id':'netHelp'
                        ,'fill':'blue'
                        ,'font-size':'10'
                        });
  var lines = ['-- simple Petri net editor, version 0.1-alpha (18/05/2010) --'
              ,' '
              ,'press "t" then click on background to add transitions'
              ,'press "p" then click on background to add places'
              ,'press "a" then drag from node to node to add arcs'
              ,' '
              ,'press "m" then use mouse to move nodes or arc midpoints'
              ,'press "d" then click to delete nodes, arcs, or arc midpoints'
              ,'click on labels to rename nodes'
              ,' '
              ,'use file selector above to import simple PNML files'
              ,'use "export PNML" button above to export simple PNML files'
              ,'use "export SVG" button above to export SVG files'
              ,' '
              ,'press "?" to toggle this help text'
              ];
  for (var l in lines) {
    var tspan = elementNS(svgNS,'tspan',{'dy':'1em','x':'0em'}
                         ,[document.createTextNode(lines[l])]);
    this.help.appendChild(tspan);
  }
  this.help.style.display = 'none';
  this.svg.appendChild(this.help);
}
Net.prototype.toggleHelp = function() {
  if (this.help.style.display==='none') {
    this.svg.removeChild(this.help);
    this.svg.insertBefore(this.help,null);
    this.help.style.display='inline';
  } else
    this.help.style.display='none';
}

/**
 * SVG definitions (currently just an arrowhead marker for arcs)
 */
Net.prototype.addDefs = function () {
  var arrow = elementNS(svgNS,'marker'
                        ,{'id':'Arrow'
                         ,'viewBox':'0 0 10 10'
                         ,'refX':'10'
                         ,'refY':'5'
                         ,'markerUnits':'userSpaceOnUse'
                         ,'markerWidth':'10'
                         ,'markerHeight':'10'
                         ,'orient':'auto'
                         }
                        ,[elementNS(svgNS,'path'
                                   ,{'d':'M 0 0 L 10 5 L 0 10 z'})]);
  var join = elementNS(svgNS,'marker'
                        ,{'id':'Join'
                         ,'viewBox':'0 0 3 3'
                         ,'refX':'1.5'
                         ,'refY':'1.5'
                         ,'markerUnits':'userSpaceOnUse'
                         ,'markerWidth':'3'
                         ,'markerHeight':'3'
                         ,'orient':'auto'
                         }
                        ,[elementNS(svgNS,'circle'
                                   ,{'r':'1.5','cx':'1.5','cy':'1.5'})]);

  var defs   = elementNS(svgNS,'defs',{},[arrow,join]);
  this.svg.appendChild(defs);
}

/**
 * translate event coordinates to svg coordinates
 * (why is this "screen" vs "client"?)
 * 
 * @param event
 */
Net.prototype.client2canvas = function (event) {
  var ctm = this.svg.getScreenCTM();
  var p = this.svg.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  return p.matrixTransform(ctm.inverse());
}

/**
 * event handler: create and add node (Place or Transition) to Net, depending on
 *                Cursor mode
 * 
 * @param event
 */
Net.prototype.clickHandler = function (event) {
  // message('Net.clickHandler '+this.cursor.mode);
  var p = this.client2canvas(event);
  if (this.cursor.mode=='p') {
    var defaultName = 'p'+this.clicks++;
    var name = prompt('name of new place: ',defaultName);
    if (name!=null) this.addPlace(name,p.x,p.y);
  } else if (this.cursor.mode=='t') {
    var defaultName = 't'+this.clicks++;
    var name = prompt('name of new transition: ',defaultName);
    if (name!=null) this.addTransition(name,p.x,p.y)
  } else
    ; // message('net.click: '+p.x+'/'+p.y);
  return true;
}

/**
 * create and add an Arc from source to target, with optional midpoints;
 * register Arc with Net, source, and target nodes;
 * 
 * @param source
 * @param target
 * @param midpoints
 */
Net.prototype.addArc = function (source,target,midpoints) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target,midpoints);
    this.arcs.push(arc);
    source.registerArcAtSource(arc);
    target.registerArcAtTarget(arc);
    this.contents.appendChild(arc.a);
    return arc;
  }
}

/**
 * remove Arc, unregister from Net, source and target nodes
 * 
 * @param arc
 */
Net.prototype.removeArc = function (arc) {
  delete this.arcs[this.arcs.indexOf(arc)];
  // TODO: this should move to Arc()
  arc.source.unregisterArcAtSource(arc);
  arc.target.unregisterArcAtTarget(arc);
  this.contents.removeChild(arc.a);
}

/**
 * create and add Place to Net, with id and name, at position x/y, with radius r;
 * name and r are optional
 * 
 * @param id
 * @param x
 * @param y
 * @param r
 * @param name
 */
Net.prototype.addPlace = function (id,x,y,r,name) {
  var place = new Place(this,id,name?name:id
                       ,new Pos(x,y)
                       ,r?r:this.r);
  this.places[id] = place;
  this.contents.appendChild(place.p);
  return place;
}

/**
 * remove Place from Net
 * 
 * @param place
 */
Net.prototype.removePlace = function (place) {
  delete this.places[place.id];
  // TODO: this should move to NODE()
  for (var arcIn in place.arcsIn) this.removeArc(place.arcsIn[arcIn]);
  for (var arcOut in place.arcsOut) this.removeArc(place.arcsOut[arcOut]);
  this.contents.removeChild(place.p);
  this.contents.removeChild(place.l);
}

/**
 * create and add Transition to Net, with id and name, at position x/y, with
 * width w, height h; name, w, and h are optional;
 * 
 * @param id
 * @param x
 * @param y
 * @param w
 * @param h
 * @param name
 */
Net.prototype.addTransition = function (id,x,y,w,h,name) {
  var transition = new Transition(this,id,name?name:id
                                 ,new Pos(x,y)
                                 ,w?w:this.transitionWidth
                                 ,h?h:this.transitionHeight
                                 );
  this.transitions[id] = transition;
  this.contents.appendChild(transition.t);
  return transition;
}

/**
 * remove Transition from Net
 * 
 * @param transition
 */
Net.prototype.removeTransition = function (transition) {
  delete this.transitions[transition.id];
  // TODO: this should move to NODE()
  for (var arcIn in transition.arcsIn) this.removeArc(transition.arcsIn[arcIn]);
  for (var arcOut in transition.arcsOut) this.removeArc(transition.arcsOut[arcOut]);
  this.contents.removeChild(transition.t);
  this.contents.removeChild(transition.l);
}

/**
 * remove all nodes (and therefore, all arcs) from Net
 */
Net.prototype.removeAll = function () {
  for (var p in this.places) this.removePlace(this.places[p]);
  for (var t in this.transitions) this.removeTransition(this.transitions[t]);
}

// seems we can only listen for keys outside svg
// we only set a mode for use in later, more specific events 
// TODO: move to Cursor?
/**
 * event handler: listen to keypresses, setting Cursor mode
 * 
 * @param event
 */
Net.prototype.keypressHandler = function (event) {
  // TODO: spec says charCode if printable, keyCode otherwise;
  //       opera 10.10 always seems to use keyCode, firefox follows spec?
  var key = event.charCode || event.keyCode;
  this.cursor.mode = String.fromCharCode(key);
  // message('Net.keypressHandler '+this.cursor.mode+' '+event.charCode+'/'+event.keyCode);

  // '\esc' should cancel anything in progress, leaving neutral state,
  // other keys should first enter neutral state, then set new cursor mode
  // TODO: safari 5.0 doesn't listen to \esc; workaround: use other unused key for now
  if (this.selection) {
    if (this.selection instanceof Arc) {
      message('cancelling Arc construction in progress');
      this.contents.removeChild(this.selection.a);
      this.selection.source.cancelListeners();

    } else if ((this.selection instanceof Place)
             ||(this.selection instanceof Transition)) {
      message('cancelling Node move in progress');
      this.selection.cancelListeners();
    }
    this.selection = null;
  }

  switch (this.cursor.mode) {
    case 't': this.cursor.transitionCursor(); break;
    case 'p': this.cursor.placeCursor(); break;
    case 'm': this.cursor.moveCursor(); break;
    case 'd': this.cursor.deleteCursor(); break;
    case '?': this.toggleHelp(); break;
    default: this.cursor.defaultCursor(); 
  }
  // event.preventDefault(); // how to do this only inside svg?  would it help
                             // to wrap the svg in a div and use that?
  // message('Net.keypressHandler event.target: '+event.target.nodeName);
  return true;
}

/**
 * event handler: let Cursor position follow mouse moves
 * 
 * @param event
 */
Net.prototype.mousemoveHandler = function (event) {
  var p = this.client2canvas(event);
  // message('Net.mousemoveHandler '+p.x+'/'+p.y);
  // document.getElementById('messageField').innerHTML=p.x+'/'+p.y;
  this.cursor.updatePos(p);
  return true;
}

// ----------------------------- }}}

