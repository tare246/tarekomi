import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const threadsRef = collection(db, "threads");

const THREADS_PER_PAGE = 20;
const POSTS_PER_PAGE = 20;
const VALID_BOARDS = new Set(["link1", "link2"]);
const BOARD_NAMES = {
  link1: "テーマ話",
  link2: "馴れ合い"
};

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

const formatDate = (value) => {
  if (!value) return "日時取得中";
  const date = value instanceof Date
    ? value
    : typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const dayName = dayNames[date.getDay()];
  return `${month}/${day}(${dayName}) ${hours}:${minutes}`;
};

const sanitizeText = (text) => (text || "").replace(/[\r\n]+/g, "\n").trim();

const getTextFormValue = (formData, key) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
};

const getShortUrlLabel = (value) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname;
  } catch (error) {
    return null;
  }
};

const renderBodyWithLinks = (message, container) => {
  const fragment = document.createDocumentFragment();
  const lines = message.split("\n");
  const urlRegex = /https?:\/\/[^\s]+/gi;

  lines.forEach((line, lineIndex) => {
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(line)) !== null) {
      const [url] = match;
      const start = match.index;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(line.slice(lastIndex, start)));
      }

      const label = getShortUrlLabel(url);
      if (label && isHttpUrl(url)) {
        const link = document.createElement("a");
        link.className = "inline-link";
        link.href = `./confirm.html?url=${encodeURIComponent(url)}`;
        link.textContent = label;
        fragment.appendChild(link);
      } else {
        fragment.appendChild(document.createTextNode(url));
      }

      lastIndex = start + url.length;
    }

    if (lastIndex < line.length) {
      fragment.appendChild(document.createTextNode(line.slice(lastIndex)));
    }

    if (lineIndex < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });

  container.replaceChildren(fragment);
};

const getAuthorKey = (name = "", trip = "") => `${name}${trip}`;

const setupImageViewer = () => {
  let viewer = document.querySelector("[data-image-viewer]");
  if (viewer) return viewer;

  viewer = document.createElement("div");
  viewer.className = "image-viewer";
  viewer.setAttribute("data-image-viewer", "");
  viewer.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "image-viewer__backdrop";

  const content = document.createElement("div");
  content.className = "image-viewer__content";

  const img = document.createElement("img");
  img.className = "image-viewer__image";
  img.alt = "添付画像";
  img.setAttribute("data-image-viewer-img", "");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-viewer__close";
  closeButton.textContent = "×";

  content.appendChild(closeButton);
  content.appendChild(img);
  viewer.appendChild(backdrop);
  viewer.appendChild(content);
  document.body.appendChild(viewer);

  const closeViewer = () => {
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    img.removeAttribute("src");
    document.body.style.overflow = "";
  };

  backdrop.addEventListener("click", closeViewer);
  closeButton.addEventListener("click", closeViewer);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });

  viewer.show = (src) => {
    if (!src) return;
    img.src = src;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  return viewer;
};

const getDeviceType = (userAgent = "") => {
  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/android/i.test(userAgent)) return "Android";
  return "PC";
};

const normalizeDeviceType = (value = "") => {
  if (["iPhone", "Android", "PC"].includes(value)) return value;
  return getDeviceType(value);
};

const extractYouTubeIds = (text = "") => {
  const ids = [];
  const regex = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
};

const createYouTubeEmbed = (videoId) => {
  const wrapper = document.createElement("div");
  wrapper.className = "media-embed";

  const thumbButton = document.createElement("button");
  thumbButton.type = "button";
  thumbButton.className = "media-thumb";
  thumbButton.setAttribute("aria-label", "YouTube動画を再生");

  const img = document.createElement("img");
  img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  img.alt = "YouTubeサムネイル";
  img.loading = "lazy";
  thumbButton.appendChild(img);

  thumbButton.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
    iframe.title = "YouTube video player";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    wrapper.innerHTML = "";
    wrapper.appendChild(iframe);
  });

  wrapper.appendChild(thumbButton);
  return wrapper;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const sha1 = (message) => {
  const msg = unescape(encodeURIComponent(message));
  const msgLen = msg.length;
  const wordArray = [];
  for (let i = 0; i < msgLen - 3; i += 4) {
    wordArray.push(
      (msg.charCodeAt(i) << 24)
        | (msg.charCodeAt(i + 1) << 16)
        | (msg.charCodeAt(i + 2) << 8)
        | msg.charCodeAt(i + 3)
    );
  }

  let remaining = 0;
  switch (msgLen % 4) {
    case 0:
      remaining = 0x080000000;
      break;
    case 1:
      remaining = (msg.charCodeAt(msgLen - 1) << 24) | 0x0800000;
      break;
    case 2:
      remaining = (msg.charCodeAt(msgLen - 2) << 24)
        | (msg.charCodeAt(msgLen - 1) << 16)
        | 0x08000;
      break;
    default:
      remaining = (msg.charCodeAt(msgLen - 3) << 24)
        | (msg.charCodeAt(msgLen - 2) << 16)
        | (msg.charCodeAt(msgLen - 1) << 8)
        | 0x80;
      break;
  }
  wordArray.push(remaining);

  while ((wordArray.length % 16) !== 14) {
    wordArray.push(0);
  }
  wordArray.push(msgLen >>> 29);
  wordArray.push((msgLen << 3) & 0x0ffffffff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array(80);
  for (let block = 0; block < wordArray.length; block += 16) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = wordArray[block + i];
    }
    for (let i = 16; i < 80; i += 1) {
      const value = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (value << 1) | (value >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i += 1) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) & 0x0ffffffff;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) & 0x0ffffffff;
    h1 = (h1 + b) & 0x0ffffffff;
    h2 = (h2 + c) & 0x0ffffffff;
    h3 = (h3 + d) & 0x0ffffffff;
    h4 = (h4 + e) & 0x0ffffffff;
  }

  const words = [h0, h1, h2, h3, h4];
  const bytes = [];
  words.forEach((word) => {
    bytes.push((word >>> 24) & 0xff);
    bytes.push((word >>> 16) & 0xff);
    bytes.push((word >>> 8) & 0xff);
    bytes.push(word & 0xff);
  });
  return bytes;
};

const bytesToBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const createTripcode = (seed) => {
  const digest = sha1(seed);
  return bytesToBase64(digest).replace(/=+$/g, "").slice(0, 10);
};

const parseNameWithTrip = (input) => {
  const trimmed = sanitizeText(input || "");
  if (!trimmed.includes("#")) {
    return { name: trimmed || "名無し", trip: "" };
  }
  const [namePart, tripSeed] = trimmed.split("#");
  const name = sanitizeText(namePart) || "名無し";
  const seed = sanitizeText(tripSeed || "");
  if (!seed) {
    return { name, trip: "" };
  }
  return { name, trip: `◆${createTripcode(seed)}` };
};

const getParams = () => new URLSearchParams(window.location.search);

const getPageParam = () => {
  const pageRaw = getParams().get("page");
  const page = Number.parseInt(pageRaw || "1", 10);
  return Number.isNaN(page) || page < 1 ? 1 : page;
};

const getBoardIdParam = () => {
  const boardId = getParams().get("board");
  if (!boardId || !VALID_BOARDS.has(boardId)) return null;
  return boardId;
};

const getThreadIdParam = () => {
  const threadId = getParams().get("thread");
  if (!threadId) return null;
  return threadId;
};

const createPagerLink = (baseParams, page, label, isActive = false) => {
  const params = new URLSearchParams(baseParams);
  params.set("page", page);
  const link = document.createElement("a");
  link.className = "pager__link";
  link.href = `?${params.toString()}`;
  link.textContent = label;
  if (isActive) {
    link.setAttribute("aria-current", "page");
  }
  return link;
};

const renderThreadPager = (pagers, baseParams, currentPage, totalPages) => {
  pagers.forEach((pager) => {
    pager.innerHTML = "";
  });

  if (totalPages <= 1) return;

  pagers.forEach((pager) => {
    const mark = document.createElement("span");
    mark.className = "pager__mark";
    mark.textContent = "■";
    pager.appendChild(mark);

    if (currentPage > 1) {
      pager.appendChild(createPagerLink(baseParams, currentPage - 1, "前へ"));
    }

    for (let page = 1; page <= totalPages; page += 1) {
      pager.appendChild(createPagerLink(baseParams, page, `${page}`, page === currentPage));
    }

    if (currentPage < totalPages) {
      pager.appendChild(createPagerLink(baseParams, currentPage + 1, "次へ"));
    }
  });
};

const loadThreadList = (boardId, { onUpdate, onError }) => {
  const threadsQuery = query(
    threadsRef,
    where("boardId", "==", boardId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    threadsQuery,
    (snapshot) => {
      const threads = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onUpdate(threads);
    },
    (error) => {
      console.error("Firestore snapshot error:", error);
      if (onError) onError("スレッドの取得に失敗しました。");
    }
  );
};

const loadThreadPosts = (threadId, { onUpdate, onError }) => {
  const postsQuery = query(
    collection(db, "threads", threadId, "posts"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onUpdate(posts);
    },
    (error) => {
      console.error("Firestore posts snapshot error:", error);
      if (onError) onError("投稿の取得に失敗しました。");
    }
  );
};

const deleteThreadWithPosts = async (threadId) => {
  const postsSnapshot = await getDocs(collection(db, "threads", threadId, "posts"));
  const batch = writeBatch(db);
  postsSnapshot.forEach((post) => batch.delete(post.ref));
  batch.delete(doc(db, "threads", threadId));
  await batch.commit();
};

const renderThreadList = () => {
  const boardId = document.body.dataset.board;
  if (!boardId || !VALID_BOARDS.has(boardId)) return;

  const list = document.querySelector("[data-thread-list]");
  const header = document.querySelector(".thread-head__title");
  const pagers = Array.from(document.querySelectorAll("[data-thread-pager]"));

  if (!list) return;

  const render = (threads) => {
    list.innerHTML = "";

    if (header) {
      header.textContent = `スレ一覧 (${threads.length}件)`;
    }

    if (threads.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "スレッドがありません。";
      list.appendChild(empty);
      return;
    }

    const currentPage = getPageParam();
    const totalPages = Math.ceil(threads.length / THREADS_PER_PAGE);
    const page = Math.min(currentPage, totalPages);
    const startIndex = (page - 1) * THREADS_PER_PAGE;
    const pageThreads = threads.slice(startIndex, startIndex + THREADS_PER_PAGE);

    renderThreadPager(pagers, "", page, totalPages);

    pageThreads.forEach((thread) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "thread-link";
      link.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
      link.textContent = `${thread.title} (${thread.postCount || 0})`;
      item.appendChild(link);
      list.appendChild(item);
    });
  };

  loadThreadList(boardId, {
    onUpdate: render,
    onError: (message) => {
      list.innerHTML = "";
      const item = document.createElement("li");
      item.textContent = message;
      list.appendChild(item);
    }
  });
};

const renderThreadPage = () => {
  const pageRoot = document.querySelector("[data-thread-page]");
  if (!pageRoot) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();
  const boardName = boardId ? BOARD_NAMES[boardId] : null;

  const boardTitle = document.querySelector("[data-thread-board]");
  const threadTitle = document.querySelector("[data-thread-title]");
  const postsRoot = document.querySelector("[data-posts]");
  const threadActions = document.querySelector("[data-thread-actions]");
  const writeLinks = document.querySelectorAll("[data-write-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");
  const pagers = Array.from(document.querySelectorAll("[data-post-pager]"));

  if (!postsRoot) return;

  if (!boardId || !threadId || !boardName) {
    postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
    return;
  }

  if (boardTitle) boardTitle.textContent = boardName;

  writeLinks.forEach((link) => {
    link.href = `./write.html?board=${boardId}&thread=${threadId}`;
  });

  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  const imageViewer = setupImageViewer();

  const renderThreadActions = (thread) => {
    if (!threadActions) return;
    threadActions.innerHTML = "";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "action-button";
    editButton.textContent = "[スレ編集]";
    editButton.addEventListener("click", () => {
      if (!threadTitle) return;
      threadTitle.replaceChildren();
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "inline-input";
      titleInput.maxLength = 60;
      titleInput.value = thread.title || "";
      threadTitle.appendChild(titleInput);

      threadActions.replaceChildren();
      const passInput = document.createElement("input");
      passInput.type = "text";
      passInput.className = "inline-input";
      passInput.placeholder = "削除パスワード";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "action-button";
      saveButton.textContent = "[保存]";
      saveButton.addEventListener("click", async () => {
        if ((thread.delpass || "") !== passInput.value) {
          alert("パスワードが違います。");
          return;
        }
        const trimmed = sanitizeText(titleInput.value || "");
        if (!trimmed) {
          alert("スレッド名を入力してください。");
          return;
        }
        await updateDoc(doc(db, "threads", threadId), { title: trimmed });
      });

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "action-button";
      cancelButton.textContent = "[キャンセル]";
      cancelButton.addEventListener("click", () => {
        renderThreadPage();
      });

      threadActions.appendChild(passInput);
      threadActions.appendChild(saveButton);
      threadActions.appendChild(cancelButton);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-button";
    deleteButton.textContent = "[スレ削除]";
    deleteButton.addEventListener("click", async () => {
      if (thread.delpass) {
        const pass = window.prompt("削除パスワードを入力してください");
        if (pass === null) return;
        if (thread.delpass !== pass) {
          alert("パスワードが違います。");
          return;
        }
      } else if (!window.confirm("スレッドを削除しますか？")) {
        return;
      }
      await deleteThreadWithPosts(threadId);
      window.location.href = `./${boardId}.html`;
    });

    threadActions.appendChild(editButton);
    threadActions.appendChild(deleteButton);
  };

  const renderPosts = (thread, posts) => {
    postsRoot.innerHTML = "";

    const currentPage = getPageParam();
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const pageIndex = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const baseParams = new URLSearchParams({ board: boardId, thread: threadId });

    if (totalPages > 0 && currentPage !== pageIndex) {
      const nextParams = new URLSearchParams(getParams());
      nextParams.set("page", pageIndex);
      history.replaceState(null, "", `?${nextParams.toString()}`);
    }

    renderThreadPager(pagers, baseParams.toString(), pageIndex, totalPages);

    if (posts.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "投稿がありません。";
      postsRoot.appendChild(empty);
      return;
    }

    const startIndex = (pageIndex - 1) * POSTS_PER_PAGE;
    const pagePosts = posts.slice(startIndex, startIndex + POSTS_PER_PAGE);

    pagePosts.forEach((post, index) => {
      const message = post.message || "";
      const postNumber = startIndex + index + 1;
      const article = document.createElement("article");
      article.className = "post";

      const head = document.createElement("div");
      head.className = "post__head";

      const no = document.createElement("span");
      no.className = "post__no";
      no.textContent = `${postNumber}：`;

      const name = document.createElement("span");
      name.className = "post__name";
      const displayName = post.trip ? `${post.name} ${post.trip}` : post.name;
      name.textContent = displayName || "名無し";

      head.appendChild(no);
      head.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "post__meta";
      meta.textContent = formatDate(post.createdAt);

      const body = document.createElement("div");
      body.className = "post__body";
      renderBodyWithLinks(message, body);

      const media = document.createElement("div");
      media.className = "post__media";
      extractYouTubeIds(message).forEach((videoId) => {
        media.appendChild(createYouTubeEmbed(videoId));
      });

      const ua = document.createElement("div");
      ua.className = "post__ua";
      ua.textContent = normalizeDeviceType(post.ua);

      article.appendChild(head);
      article.appendChild(meta);
      article.appendChild(body);
      if (media.childNodes.length > 0) {
        article.appendChild(media);
      }

      if (post.imageData) {
        const imageWrap = document.createElement("div");
        imageWrap.className = "post__image";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "post__image-button";
        const img = document.createElement("img");
        img.className = "post__image-thumb";
        img.src = post.imageData;
        img.alt = "添付画像";
        button.appendChild(img);
        button.addEventListener("click", () => {
          imageViewer.show(post.imageData);
        });
        imageWrap.appendChild(button);
        article.appendChild(imageWrap);
      }

      article.appendChild(ua);

      const actions = document.createElement("div");
      actions.className = "post__actions";

      const deleteLink = document.createElement("button");
      deleteLink.type = "button";
      deleteLink.className = "action-button";
      deleteLink.textContent = "[削除]";
      deleteLink.addEventListener("click", async () => {
        const pass = window.prompt("削除パスワードを入力してください");
        if (pass === null) return;
        if ((post.delpass || "") !== pass) {
          alert("パスワードが違います。");
          return;
        }
        await deleteDoc(doc(db, "threads", threadId, "posts", post.id));
        await updateDoc(doc(db, "threads", threadId), {
          postCount: increment(-1)
        });
      });

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "action-button";
      editButton.textContent = "[編集]";
      editButton.addEventListener("click", () => {
        body.replaceChildren();
        const textarea = document.createElement("textarea");
        textarea.className = "inline-textarea";
        textarea.rows = 6;
        textarea.value = message;
        body.appendChild(textarea);

        const editActions = document.createElement("div");
        editActions.className = "inline-actions";

        const passInput = document.createElement("input");
        passInput.type = "text";
        passInput.className = "inline-input";
        passInput.placeholder = "削除パスワード";

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "action-button";
        saveButton.textContent = "[保存]";
        saveButton.addEventListener("click", async () => {
          if ((post.delpass || "") !== passInput.value) {
            alert("パスワードが違います。");
            return;
          }
          const nextMessage = sanitizeText(textarea.value || "");
          if (!nextMessage) {
            alert("本文を入力してください。");
            return;
          }
          await updateDoc(doc(db, "threads", threadId, "posts", post.id), {
            message: nextMessage
          });
        });

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "action-button";
        cancelButton.textContent = "[キャンセル]";
        cancelButton.addEventListener("click", () => {
          renderThreadPage();
        });

        editActions.appendChild(passInput);
        editActions.appendChild(saveButton);
        editActions.appendChild(cancelButton);
        body.appendChild(editActions);
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteLink);
      article.appendChild(actions);

      postsRoot.appendChild(article);

      if (index !== pagePosts.length - 1) {
        const divider = document.createElement("hr");
        divider.className = "rule rule-tight";
        postsRoot.appendChild(divider);
      }
    });
  };

  const threadDocRef = doc(db, "threads", threadId);
  onSnapshot(threadDocRef, (docSnap) => {
    if (!docSnap.exists()) {
      postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
      return;
    }
    const thread = { id: docSnap.id, ...docSnap.data() };
    if (threadTitle) threadTitle.textContent = thread.title;
    renderThreadActions(thread);
  });

  loadThreadPosts(threadId, {
    onUpdate: (posts) => {
      renderPosts({}, posts);
    },
    onError: (message) => {
      postsRoot.innerHTML = `<p>${message}</p>`;
    }
  });
};

const renderWritePage = () => {
  const page = document.querySelector("[data-write-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();
  const boardName = boardId ? BOARD_NAMES[boardId] : null;
  const form = document.querySelector("[data-write-form]");
  const note = document.querySelector("[data-write-note]");
  const fileInput = document.querySelector("#file-input");
  const fileName = document.querySelector("[data-file-name]");
  const boardTitle = document.querySelector("[data-write-board]");
  const threadTitle = document.querySelector("[data-write-thread]");
  const threadLink = document.querySelector("[data-thread-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId || !threadId || !boardName) {
    if (note) note.textContent = "スレッドが見つかりません。";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = boardName;
  if (threadLink) threadLink.href = `./thread.html?board=${boardId}&thread=${threadId}`;
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  const threadDocRef = doc(db, "threads", threadId);
  getDoc(threadDocRef).then((docSnap) => {
    if (!docSnap.exists()) {
      if (note) note.textContent = "スレッドが見つかりません。";
      if (form) form.querySelector("button").disabled = true;
      return;
    }
    const thread = docSnap.data();
    if (threadTitle) threadTitle.textContent = `└ ${thread.title}`;
  });

  if (fileInput && fileName) {
    fileInput.addEventListener("change", () => {
      fileName.textContent = fileInput.files?.[0]?.name || "未選択";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const message = sanitizeText(getTextFormValue(formData, "message"));
    if (!message) {
      if (note) note.textContent = "本文を入力してください。";
      return;
    }

    const file = formData.get("file");
    let fileNameValue = "";
    let imageData = "";
    if (file && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        if (note) note.textContent = "添付ファイルは5MB以内にしてください。";
        return;
      }
      fileNameValue = file.name;
      if (!file.type.startsWith("image/")) {
        if (note) note.textContent = "画像ファイルを選択してください。";
        return;
      }
      try {
        const result = await readFileAsDataUrl(file);
        if (typeof result === "string") {
          imageData = result;
        }
      } catch (error) {
        if (note) note.textContent = "画像の読み込みに失敗しました。";
        return;
      }
    }

    const { name, trip } = parseNameWithTrip(formData.get("name"));
    const author = getAuthorKey(name, trip);
    const post = {
      name,
      trip,
      author,
      email: sanitizeText(formData.get("email") || ""),
      message,
      createdAt: serverTimestamp(),
      ua: getDeviceType(navigator.userAgent || ""),
      delpass: sanitizeText(formData.get("delpass") || ""),
      fileName: fileNameValue,
      imageData
    };

    try {
      if (note) note.textContent = "";
      await addDoc(collection(db, "threads", threadId, "posts"), post);
      await updateDoc(doc(db, "threads", threadId), {
        postCount: increment(1),
        updatedAt: serverTimestamp()
      });
      window.location.href = `./thread.html?board=${boardId}&thread=${threadId}`;
    } catch (error) {
      console.error("Firestore add error:", error);
      if (note) note.textContent = "投稿に失敗しました。";
    }
  });
};

const renderNewThreadPage = () => {
  const page = document.querySelector("[data-new-thread-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const boardName = boardId ? BOARD_NAMES[boardId] : null;
  const form = document.querySelector("[data-new-thread-form]");
  const note = document.querySelector("[data-new-thread-note]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId || !boardName) {
    if (note) note.textContent = "掲示板が見つかりません。";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = boardName;
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const title = sanitizeText(getTextFormValue(formData, "title"));
    const message = sanitizeText(getTextFormValue(formData, "message"));

    if (!title || !message) {
      if (note) note.textContent = "タイトルと本文を入力してください。";
      return;
    }

    const { name, trip } = parseNameWithTrip(formData.get("name"));
    const author = getAuthorKey(name, trip);
    const delpass = sanitizeText(formData.get("delpass") || "");

    try {
      if (note) note.textContent = "";
      const threadDoc = await addDoc(threadsRef, {
        boardId,
        title,
        author,
        delpass,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        postCount: 1
      });

      await addDoc(collection(db, "threads", threadDoc.id, "posts"), {
        name,
        trip,
        author,
        email: sanitizeText(formData.get("email") || ""),
        message,
        createdAt: serverTimestamp(),
        ua: getDeviceType(navigator.userAgent || ""),
        delpass
      });

      window.location.href = `./thread.html?board=${boardId}&thread=${threadDoc.id}`;
    } catch (error) {
      console.error("Firestore add error:", error);
      if (note) note.textContent = "スレッド作成に失敗しました。";
    }
  });
};

const renderSearchPage = () => {
  const page = document.querySelector("[data-search-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const boardName = boardId ? BOARD_NAMES[boardId] : null;
  const form = document.querySelector("[data-search-form]");
  const results = document.querySelector("[data-search-results]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId || !boardName) {
    if (results) results.innerHTML = "<li>掲示板が見つかりません。</li>";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = boardName;
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  const showResults = async (keyword) => {
    results.innerHTML = "";
    const normalized = keyword.toLowerCase();

    const threadSnapshot = await getDocs(
      query(threadsRef, where("boardId", "==", boardId), orderBy("createdAt", "desc"))
    );

    const threads = await Promise.all(
      threadSnapshot.docs.map(async (docSnap) => {
        const thread = { id: docSnap.id, ...docSnap.data() };
        if (thread.title?.toLowerCase().includes(normalized)) {
          return { thread, match: true };
        }
        const postsSnapshot = await getDocs(collection(db, "threads", thread.id, "posts"));
        const match = postsSnapshot.docs.some((postSnap) =>
          (postSnap.data().message || "").toLowerCase().includes(normalized)
        );
        return { thread, match };
      })
    );

    const matches = threads.filter((entry) => entry.match).map((entry) => entry.thread);

    if (matches.length === 0) {
      const item = document.createElement("li");
      item.textContent = "該当するスレッドがありません。";
      results.appendChild(item);
      return;
    }

    matches.forEach((thread) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "thread-link";
      link.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
      link.textContent = `${thread.title} (${thread.postCount || 0})`;
      item.appendChild(link);
      results.appendChild(item);
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const keyword = sanitizeText(formData.get("keyword") || "");
    if (!keyword) return;
    showResults(keyword);
  });
};

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

renderThreadList();
renderThreadPage();
renderWritePage();
renderNewThreadPage();
renderSearchPage();
renderConfirmPage();