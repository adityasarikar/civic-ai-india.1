// Import from firebase.js
import {
  auth,
  provider,
  signInWithPopup,
  db,
  storage,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let lastComplaintId = null;
let model = null;
let lastResult = null;

//
// 🔐 LOGIN
//
window.login = async function () {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;

    document.getElementById("user").innerText = currentUser.email;

    console.log("Logged in:", currentUser.email);
  } catch (err) {
    console.error(err);
    alert("Login failed");
  }
};

//
// 🔄 KEEP USER LOGGED IN
//
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    const el = document.getElementById("user");
    if (el) el.innerText = user.email;
  }
});

//
// 🤖 LOAD AI MODEL
//
async function loadModel() {
  try {
    model = await tf.loadLayersModel("model/model.json");
    console.log("Model loaded");
  } catch (err) {
    console.warn("Model not loaded yet (ok if not added)");
  }
}
loadModel();

//
// 📸 PROCESS IMAGE + CLASSIFY
//
window.processImage = async function () {
  const file = document.getElementById("imageInput").files[0];

  if (!file) {
    alert("Upload image first");
    return;
  }

  try {
    // Upload to Firebase Storage
    const storageRef = ref(storage, "images/" + Date.now() + "_" + file.name);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Load image into TensorFlow
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      if (!model) {
        alert("Model not loaded yet");
        return;
      }

      const tensor = tf.browser.fromPixels(img)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .expandDims();

      const prediction = await model.predict(tensor).data();

      const classes = [
        "battery",
        "biological",
        "cardboard",
        "glass",
        "metal",
        "paper",
        "plastic",
        "trash"
      ];

      const index = prediction.indexOf(Math.max(...prediction));
      const result = classes[index];

      document.getElementById("result").innerText = "Detected: " + result;

      lastResult = {
        category: result,
        imageURL: url
      };
    };

  } catch (err) {
    console.error(err);
    alert("Upload/Classify error");
  }
};

//
// 🟢 CREATE COMPLAINT
//
window.createComplaint = async function () {
  if (!currentUser || !lastResult) {
    alert("Login and classify image first");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "complaints"), {
      userId: currentUser.uid,
      email: currentUser.email,
      category: lastResult.category,
      imageURL: lastResult.imageURL,
      status: "open",
      createdAt: new Date()
    });

    lastComplaintId = docRef.id;

    alert("Complaint created successfully");
  } catch (err) {
    console.error(err);
    alert("Error creating complaint");
  }
};

//
// 🔵 CLOSE COMPLAINT
//
window.closeComplaint = async function () {
  if (!lastComplaintId) {
    alert("No complaint selected");
    return;
  }

  try {
    await updateDoc(doc(db, "complaints", lastComplaintId), {
      status: "closed"
    });

    alert("Complaint closed");
  } catch (err) {
    console.error(err);
    alert("Error closing complaint");
  }
};

//
// 🔴 WITHDRAW COMPLAINT
//
window.withdrawComplaint = async function () {
  const reason = document.getElementById("reason").value;

  if (!lastComplaintId) {
    alert("No complaint selected");
    return;
  }

  try {
    await updateDoc(doc(db, "complaints", lastComplaintId), {
      status: "withdrawn",
      reason: reason
    });

    alert("Complaint withdrawn");
  } catch (err) {
    console.error(err);
    alert("Error withdrawing complaint");
  }
};

//
// 📊 LOAD DASHBOARD
//
window.loadComplaints = async function () {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const q = query(
      collection(db, "complaints"),
      where("userId", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);

    const container = document.getElementById("complaints");
    if (!container) return;

    container.innerHTML = "";

    querySnapshot.forEach((docItem) => {
      const data = docItem.data();

      container.innerHTML += `
        <div class="card">
          <p><b>Category:</b> ${data.category}</p>
          <p><b>Status:</b> ${data.status}</p>
          <img src="${data.imageURL}" width="120"/>
        </div>
      `;
    });
  });
};
