import { sanitizePage } from "./index";

const page = {
  url: "https://example.com/signup",
  title: "Test Signup",
  viewport: {
    width: 1280,
    height: 720,
    devicePixelRatio: 1,
  },
  elements: [
    {
      id: "name",
      tag: "input",
      type: "text",
      label: "Full Name",
      value: "Prasad Kathe",
      bbox: {
        x: 100,
        y: 100,
        width: 300,
        height: 40,
      },
      visible: true,
    },
    {
      id: "email",
      tag: "input",
      type: "email",
      label: "Email",
      value: "prasad@example.com",
      bbox: {
        x: 100,
        y: 160,
        width: 300,
        height: 40,
      },
      visible: true,
    },
    {
      id: "password",
      tag: "input",
      type: "password",
      label: "Password",
      value: "Manu19191",
      bbox: {
        x: 100,
        y: 220,
        width: 300,
        height: 40,
      },
      visible: true,
    },
    {
      id: "submit",
      tag: "button",
      text: "Submit",
      bbox: {
        x: 100,
        y: 280,
        width: 100,
        height: 40,
      },
      visible: true,
    },
    {
        id: "phone",
        tag: "input",
        type: "tel",
        label: "Phone",
        value: "9876543210",
        bbox: {
            x: 100,
            y: 340,
            width: 300,
            height: 40,
        },
        visible: true,
    },
    {
        id: "aadhaar",
        tag: "input",
        type: "text",
        label: "Aadhaar",
        value: "1234 5678 9012",
        bbox: {
            x: 100,
            y: 400,
            width: 300,
            height: 40,
        },
        visible: true,
    },
  ],
};

const result = sanitizePage({
  page,
});

console.log("=== SANITIZED CONTEXT ===");
console.log(JSON.stringify(result.sanitizedContext, null, 2));

console.log("=== SAFE TO TRANSMIT ===");
console.log(result.safeToTransmit);

console.log("=== DETECTIONS ===");
console.log(result.candidates);