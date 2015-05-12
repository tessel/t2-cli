// Import the interface to Tessel hardware
extern crate rust_tessel as tessel;

fn main() {
  
  // Set the led pins as outputs with initial states
  let led1 = tessel.led[0].output(1);
  let led2 = tessel.led[1].output(0);

  // Toggle the led states
  loop {
    println!("I'm blinking! (Press CTRL + C to stop)");
    led1.toggle();
    led2.toggle();
  }

}
