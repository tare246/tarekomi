import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const postsRef = collection(db, "posts");

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

const sanitizeText = (text) => (text || "").replace(/[\r\n]+/g, "\n").trim();

const formatDate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "日時取得中";
  }
  const date = timestamp.toDate();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const dayName = dayNames[date.getDay()];
  return `${month}/${day}(${dayName}) ${hours}:${minutes}`;
};

const renderPosts = (posts, container) => {
  container.innerHTML = "";
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.textContent = "投稿がありません。";
    container.appendChild(empty);
    return;
  }

  posts.forEach((post, index) => {
    const article = document.createElement("article");
    article.className = "post";

    const head = document.createElement("div");
    head.className = "post__head";

    const no = document.createElement("span");
    no.className = "post__no";
    no.textContent = `${index + 1}：`;

    const name = document.createElement("span");
    name.className = "post__name";
    name.textContent = sanitizeText(post.name) || "名無し";

    head.appendChild(no);
    head.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "post__meta";
    meta.textContent = formatDate(post.createdAt);

    const body = document.createElement("div");
    body.className = "post__body";
    const message = sanitizeText(post.message);
    const lines = message.split("\n");
    lines.forEach((line, lineIndex) => {
      const span = document.createElement("span");
      span.textContent = line;
      body.appendChild(span);
      if (lineIndex < lines.length - 1) {
        body.appendChild(document.createElement("br"));
      }
    });

    article.appendChild(head);
    article.appendChild(meta);
    article.appendChild(body);

    container.appendChild(article);

    if (index !== posts.length - 1) {
      const divider = document.createElement("hr");
      divider.className = "rule rule-tight";
      container.appendChild(divider);
    }
  });
};

const loadPosts = async ({ onUpdate, onError }) => {
  const postsQuery = query(postsRef, orderBy("createdAt", "asc"));
  if (typeof onSnapshot === "function") {
    return onSnapshot(
      postsQuery,
      (snapshot) => {
        const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        onUpdate(posts);
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        if (onError) onError("投稿の取得に失敗しました。");
      }
    );
  }

  try {
    const snapshot = await getDocs(postsQuery);
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    onUpdate(posts);
  } catch (error) {
    console.error("Firestore get error:", error);
    if (onError) onError("投稿の取得に失敗しました。");
  }

  return null;
};

const addPost = async ({ name, message }) => {
  await addDoc(postsRef, {
    name: sanitizeText(name),
    message: sanitizeText(message),
    createdAt: serverTimestamp()
  });
};

const setupThreadPage = () => {
  const pageRoot = document.querySelector("[data-thread-page]");
  if (!pageRoot) return;

  const postsRoot = document.querySelector("[data-posts]");
  const errorNote = document.querySelector("[data-post-error]");

  if (!postsRoot) return;

  loadPosts({
    onUpdate: (posts) => {
      if (errorNote) errorNote.textContent = "";
      renderPosts(posts, postsRoot);
    },
    onError: (message) => {
      if (errorNote) errorNote.textContent = message;
    }
  });
};

const setupWritePage = () => {
  const page = document.querySelector("[data-write-page]");
  if (!page) return;

  const form = document.querySelector("[data-write-form]");
  const note = document.querySelector("[data-write-note]");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = sanitizeText(formData.get("name"));
    const message = sanitizeText(formData.get("message"));

    if (!message) {
      if (note) note.textContent = "本文を入力してください。";
      return;
    }

    try {
      if (note) note.textContent = "";
      await addPost({ name, message });
      window.location.href = "./thread.html";
    } catch (error) {
      console.error("Firestore add error:", error);
      if (note) note.textContent = "投稿に失敗しました。";
    }
  });
};

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
};

const getParams = () => new URLSearchParams(window.location.search);

const renderConfirmPage = () => {
  const page = document.querySelector("[data-confirm-page]");
  if (!page) return;

  const params = getParams();
  const urlParam = params.get("url") || "";
  let decoded = "";
  try {
    decoded = decodeURIComponent(urlParam);
  } catch (error) {
    decoded = "";
  }
  const urlText = isHttpUrl(decoded) ? decoded : "";

  const urlLink = document.querySelector("[data-confirm-link]");
  const googleLink = document.querySelector("[data-confirm-google]");
  const nortonLink = document.querySelector("[data-confirm-norton]");

  if (!urlText) {
    if (urlLink) urlLink.removeAttribute("href");
    if (googleLink) googleLink.removeAttribute("href");
    if (nortonLink) nortonLink.removeAttribute("href");
    return;
  }

  if (urlLink) {
    urlLink.href = urlText;
    urlLink.textContent = urlText;
  }
  if (googleLink) {
    googleLink.href = `https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(urlText)}`;
  }
  if (nortonLink) {
    nortonLink.href = `https://safeweb.norton.com/report?url=${encodeURIComponent(urlText)}`;
  }
};

setupThreadPage();
setupWritePage();
renderConfirmPage();
