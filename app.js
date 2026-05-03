let user = null;
let model;
let lastData = null;
let lastId = null;

// LOGIN
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    user = res.user;
    document.getElementById("user").innerText = user.email;

    db.collection("users").doc(user.uid).set({
      email: user.email
    });
  });
}

// LOAD MODEL
async function loadModel() {
  model = await tf.loadLayersModel("model/model.json");
}
loadModel();

// PROCESS IMAGE
async function processImage() {
  const file = document.getElementById("imageInput").files[0];

  const ref = storage.ref("images/" + file.name);
  await ref.put(file);
  const url = await ref.getDownloadURL();

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    const tensor = tf.browser.fromPixels(img)
      .resizeNearestNeighbor([224,224])
      .toFloat()
      .expandDims();

    const pred = await model.predict(tensor).data();

    const classes = ["battery","biological","plastic","paper","metal","trash"];
    const i = pred.indexOf(Math.max(...pred));
    const result = classes[i];

    document.getElementById("result").innerText = result;

    lastData = { category: result, imageURL: url };
  };
}

// CREATE
async function createComplaint() {
  if (!user || !lastData) return alert("Login & classify first");

  const doc = await db.collection("complaints").add({
    userId: user.uid,
    category: lastData.category,
    imageURL: lastData.imageURL,
    status: "open",
    createdAt: new Date()
  });

  lastId = doc.id;
  alert("Complaint created");
}

// CLOSE
async function closeComplaint() {
  if (!lastId) return;

  await db.collection("complaints").doc(lastId).update({
    status: "closed"
  });
}

// WITHDRAW
async function withdrawComplaint() {
  const reason = document.getElementById("reason").value;

  await db.collection("complaints").doc(lastId).update({
    status: "withdrawn",
    reason: reason
  });
}

// DASHBOARD
async function loadComplaints() {
  auth.onAuthStateChanged(async (u) => {
    if (!u) return;

    const snapshot = await db.collection("complaints")
      .where("userId","==",u.uid)
      .get();

    const div = document.getElementById("complaints");

    snapshot.forEach(doc => {
      const data = doc.data();

      div.innerHTML += `
        <div class="card">
          <p>${data.category}</p>
          <p>Status: ${data.status}</p>
          <img src="${data.imageURL}" width="100">
        </div>
      `;
    });
  });
}
