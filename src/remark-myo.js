var Myo = require('myo');

module.exports = function connect (slideshow) {
  //Start talking with Myo Connect
  Myo.connect();
  Myo.on('pose', function (poseName) {
    // if (poseName === 'double_tap') {
    //   this.vibrate('short');
    //   if (!this.locked) {
    //     this.lock();
    //     this.vibrate('short');
    //   } else {
    //     this.unlock();
    //     this.vibrate('medium');
    //   }
    // }
    // else
    if (poseName === 'wave_in') {
      this.vibrate('short');
      slideshow.gotoPreviousSlide();
    }
    else if (poseName === 'wave_out') {
      this.vibrate('short');
      slideshow.gotoNextSlide();
    }
  });

  Myo.on('paired', function(){
    console.log('Myo connected');
    this.vibrate('long');
    Myo.setLockingPolicy('none');
  });
};
