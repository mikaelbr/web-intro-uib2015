var fs = require('fs');
var myo = require('./remark-myo');

setupSlideshow();
setupSoundButton();

document.querySelector('#change-image').addEventListener('click', function (e) {
  e.preventDefault();
  var myImage = document.querySelector('#my-image-1');
  myImage.src = 'assets/dance.gif';
});

var myImage2 = document.querySelector('#my-image-2');
myImage2.addEventListener('click', function (e) {
  e.preventDefault();
  myImage2.src = 'assets/dance.gif';
});


function setupSlideshow () {
  var data = fs.readFileSync(__dirname + '/../slides/slides.md', 'utf8');
  document.querySelector('#source').innerHTML = data;

  var slideshow = remark.create({
    ratio: '16:9',
    highlightStyle: 'monokai'
  });

  myo(slideshow);
}

function setupSoundButton () {
  var dialupButton = document.querySelector('#sound-button');
  var sound = null;
  dialupButton.addEventListener('click', function (e) {
    e.preventDefault();
    if (sound && sound.paused) {
      return sound.play();
    }
    if (sound && !sound.paused) {
      return sound.pause();
    }
    sound = new Audio('./assets/dial-up-modem-01.mp3');
    sound.play();
  }, false);
}
