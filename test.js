var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');

var options = new chrome.Options();
    options.addArguments("--test-type");

var driver = new webdriver.Builder().
    withCapabilities(options.toCapabilities()).
    build();

function testElement(root,by) {
  var el = root.findElement(by);
  el.then(function() {
      console.log("present:",by);
    })
    .then(null,function(){
      console.error("missing:",by);
    });
  return el;
}

function testLabel(cls,label,by) {
  var lastElement = driver.findElement(by)
  lastElement.then(function(el){
                    webdriver.promise.all([el.getAttribute('class'),el.getText()])
                      .then(function(ct){
                              if (ct[0]===cls && ct[1]===label)
                                console.log('present: '+cls+' '+label);
                              else
                                throw ('wrong class '+ct[0]+' or text '+ct[1]);
                            }) })
             .then(null,function(error){console.error('missing '+cls+': '+label,error)});
}

var target = 'file://'+__dirname.replace(/\\/g,'/')+'/js/svgtest.html';
console.log("navigating to: ",target);
driver.navigate().to(target);

var body = driver.findElement(webdriver.By.tagName('body'))

// main gui elements
var netDiv = driver.findElement(webdriver.By.id('netDiv'))

testElement(netDiv,webdriver.By.tagName('select'));

var importExportGroup = testElement(netDiv,webdriver.By.id('importExportGroup'));
testElement(importExportGroup,webdriver.By.tagName('form'));
testElement(importExportGroup,webdriver.By.id('exportSVG'));
testElement(importExportGroup,webdriver.By.id('exportPNML'));
testElement(importExportGroup,webdriver.By.id('generateCode'));

var svgDiv = testElement(netDiv,webdriver.By.id('svgDiv'));
var netHelp = testElement(svgDiv,webdriver.By.id('netHelp'));

// help visibility and toggling
// TODO: select help "mode" keeps toggling help while overlaying previous mode
netHelp.isDisplayed().then(function(displayed){
  console.log("help visible:",displayed);
});

body.sendKeys("?").then(function(){
  netHelp.isDisplayed().then(function(displayed){
    console.log("help toggled off by '?':",!displayed);
  });
});

// transition creation mode
body.sendKeys("t").then(function(){
  testElement(svgDiv,webdriver.By.css('svg #cursorPalette #transitionCursor'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T0");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .transition#T0'));
  testLabel('label','T0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .transition#T1'));
  testLabel('label','T1',webdriver.By.css('svg #contents :nth-last-child(2)'));
});

// place creation mode
body.sendKeys("p").then(function(){
  testElement(svgDiv,webdriver.By.css('svg #cursorPalette #placeCursor'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P0");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .place#P0'));
  testLabel('label','P0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .place#P1'));
  testLabel('label','P1',webdriver.By.css('svg #contents :nth-last-child(2)'));
});

// arc creation mode
body.sendKeys("a").then(function(){
  // TODO: no mode cursor?
  //       add label mode?
  //       how to test for individual arcs?
  //       geometry tests?

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){console.log("created 1 arc: ",arcs.length===1)});

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){console.log("created 2 arc: ",arcs.length===2)});

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){console.log("created 3 arc: ",arcs.length===3)});

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){console.log("created 4 arc: ",arcs.length===4)});

  // arc label creation mode
  body.sendKeys("l").then(function(){
    // TODO: no mode cursor?
    //       add label mode?
    //       geometry tests?

    driver.actions()
          .mouseMove(svgDiv,{x:150,y:100})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a1");
    prompt.accept();
    testLabel('arclabel','a1',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:200,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a2");
    prompt.accept();
    testLabel('arclabel','a2',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:150,y:200})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a3");
    prompt.accept();
    testLabel('arclabel','a3',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:100,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a4");
    prompt.accept();
    testLabel('arclabel','a4',webdriver.By.css('svg #contents :last-child'));
  });

});

// driver.quit();

