//! A blinky example for Tessel

// This enables the system allocator in your script.
// This is required to run Rust binaries on Tessel.
#![feature(alloc_system)]
extern crate alloc_system;

// Import the tessel library
extern crate tessel;
// Import the Tessel API
use tessel::Tessel;
// Import sleep from the standard lib
use std::thread::sleep;
// Import durations from the standard lib
use std::time::Duration;

fn main() {
    // Create a new Tessel
    let mut tessel = Tessel::new();

    // Turn on one of the LEDs
    tessel.led[2].on().unwrap();

    println!("I'm blinking! (Press CTRL + C to stop)");

    // Loop forever
    loop {
        // Toggle each LED
        tessel.led[2].toggle().unwrap();
        tessel.led[3].toggle().unwrap();
        // Re-execute the loop after sleeping for 100ms
        sleep(Duration::from_millis(100));
    }
}
