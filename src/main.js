// Ortho OT Assessment — static vanilla-JS PWA.
// All patient data lives in localStorage on this device. Nothing is sent anywhere.
//
// The entry point, and the only file that starts the app. Everything else defines
// something and waits to be called, so importing any of it — in a test, say — has no
// side effect.
import { render } from "./render.js";

render();
