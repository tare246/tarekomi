const STORAGE_KEY = "bbsData";
const THREADS_PER_PAGE = 20;
const POSTS_PER_PAGE = 20;
const VALID_BOARDS = new Set(["link1", "link2"]);
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
const SUPABASE_TABLE = "bbs_state";
const SUPABASE_ID = "main";

let supabaseClient = null;

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

const getSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase) {
    console.error("Supabase SDK が読み込まれていません。");
    return null;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("SUPABASE_URL または SUPABASE_ANON_KEY が設定されていません。");
    return null;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
};

const getDefaultData = () => {
  return {
    boards: {
      link1: {
        name: "テーマ話",
        threads: []
      },
      link2: {
        name: "馴れ合い",
        threads: []
      }
    }
  };
};

const loadData = async () => {
  const client = getSupabaseClient();
  if (!client) return getDefaultData();

  try {
    const { data, error } = await client
      .from(SUPABASE_TABLE)
      .select("data")
      .eq("id", SUPABASE_ID)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("Supabase からの読み込みに失敗しました。", error);
      }
      const seed = getDefaultData();
      await saveData(seed);
      return seed;
    }

    if (data?.data) {
      return data.data;
    }
  } catch (error) {
    console.error("Supabase からの読み込みに失敗しました。", error);
  }

  const seed = getDefaultData();
  await saveData(seed);
  return seed;
};

const saveData = async (data) => {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client.from(SUPABASE_TABLE).upsert({
      id: SUPABASE_ID,
      data
    });

    if (error) {
      console.error("Supabase への保存に失敗しました。", error);
    }
  } catch (error) {
    console.error("Supabase への保存に失敗しました。", error);
  }
};

const formatDate = (value) => {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const dayName = dayNames[date.getDay()];
  return `${month}/${day}(${dayName}) ${hours}:${minutes}`;
};

const sanitizeText = (text) => text.replace(/[\r\n]+/g, "\n").trim();

const getTextFormValue = (formData, key) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const createMessageFragment = (message) => {
  const fragment = document.createDocumentFragment();
  const lines = message.split("\n");
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.textContent = line;
    fragment.appendChild(span);
    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });
  return fragment;
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
  const threadIdRaw = Number(getParams().get("thread"));
  if (!Number.isFinite(threadIdRaw) || threadIdRaw <= 0) return null;
  return threadIdRaw;
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

const renderThreadList = async () => {
  const boardId = document.body.dataset.board;
  if (!boardId || !VALID_BOARDS.has(boardId)) return;
  const data = await loadData();
  const board = data.boards?.[boardId];
  const list = document.querySelector("[data-thread-list]");
  const header = document.querySelector(".thread-head__title");
  const pagers = Array.from(document.querySelectorAll("[data-thread-pager]"));

  if (!list) return;

  list.innerHTML = "";

  if (!board) {
    list.textContent = "スレッドがありません。";
    return;
  }

  if (header) {
    header.textContent = `スレ一覧 (${board.threads.length}件)`;
  }

  if (board.threads.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "スレッドがありません。";
    list.appendChild(empty);
    return;
  }

  const currentPage = getPageParam();
  const totalPages = Math.ceil(board.threads.length / THREADS_PER_PAGE);
  const page = Math.min(currentPage, totalPages);
  const sortedThreads = board.threads
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const startIndex = (page - 1) * THREADS_PER_PAGE;
  const pageThreads = sortedThreads.slice(startIndex, startIndex + THREADS_PER_PAGE);

  renderThreadPager(pagers, "", page, totalPages);

  pageThreads.forEach((thread) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "thread-link";
    link.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
    link.textContent = `${thread.title} (${thread.posts.length})`;
    item.appendChild(link);
    list.appendChild(item);
  });
};

const renderThreadPage = async () => {
  const pageRoot = document.querySelector("[data-thread-page]");
  if (!pageRoot) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();
  const data = await loadData();
  const board = boardId ? data.boards?.[boardId] : null;

  const boardTitle = document.querySelector("[data-thread-board]");
  const threadTitle = document.querySelector("[data-thread-title]");
  const postsRoot = document.querySelector("[data-posts]");
  const threadActions = document.querySelector("[data-thread-actions]");
  const writeLinks = document.querySelectorAll("[data-write-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");
  const pagers = Array.from(document.querySelectorAll("[data-post-pager]"));

  if (!postsRoot) return;

  if (!board || !threadId) {
    postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
    return;
  }

  const thread = board.threads.find((item) => item.id === threadId);
  if (!thread) {
    postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
    return;
  }

  if (!thread.author && thread.posts?.[0]) {
    thread.author = getAuthorKey(thread.posts[0].name, thread.posts[0].trip);
    await saveData(data);
  }

  if (boardTitle) boardTitle.textContent = board.name;
  if (threadTitle) threadTitle.textContent = thread.title;

  const imageViewer = setupImageViewer();

  if (threadActions) {
    threadActions.innerHTML = "";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "action-button";
    editButton.textContent = "[スレ編集]";
    editButton.addEventListener("click", async () => {
      if (!threadTitle) return;
      threadTitle.replaceChildren();
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "inline-input";
      titleInput.maxLength = 60;
      titleInput.value = thread.title;
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
        thread.title = trimmed;
        await saveData(data);
        renderThreadPage();
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
      board.threads = board.threads.filter((item) => item.id !== thread.id);
      await saveData(data);
      window.location.href = `./${boardId}.html`;
    });
    threadActions.appendChild(editButton);
    threadActions.appendChild(deleteButton);
  }

  writeLinks.forEach((link) => {
    link.href = `./write.html?board=${boardId}&thread=${thread.id}`;
  });

  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  postsRoot.innerHTML = "";

  const currentPage = getPageParam();
  const totalPages = Math.ceil(thread.posts.length / POSTS_PER_PAGE);
  const pageIndex = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const baseParams = new URLSearchParams({ board: boardId, thread: thread.id });

  if (totalPages > 0 && currentPage !== pageIndex) {
    const nextParams = new URLSearchParams(getParams());
    nextParams.set("page", pageIndex);
    history.replaceState(null, "", `?${nextParams.toString()}`);
  }

  renderThreadPager(pagers, baseParams.toString(), pageIndex, totalPages);

  if (thread.posts.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "投稿がありません。";
    postsRoot.appendChild(empty);
    return;
  }

  const startIndex = (pageIndex - 1) * POSTS_PER_PAGE;
  const pagePosts = thread.posts.slice(startIndex, startIndex + POSTS_PER_PAGE);

  let needsSave = false;

  pagePosts.forEach((post, index) => {
    const message = post.message || "";
    const postNumber = startIndex + index + 1;
    const article = document.createElement("article");
    article.className = "post";

    if (!post.author) {
      post.author = getAuthorKey(post.name, post.trip);
      needsSave = true;
    }

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
      thread.posts = thread.posts.filter((item) => item.id !== post.id);
      await saveData(data);
      renderThreadPage();
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
        post.message = nextMessage;
        await saveData(data);
        renderThreadPage();
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

  if (needsSave) {
    await saveData(data);
  }
};

const renderWritePage = async () => {
  const page = document.querySelector("[data-write-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();
  const data = await loadData();
  const board = boardId ? data.boards?.[boardId] : null;
  const form = document.querySelector("[data-write-form]");
  const note = document.querySelector("[data-write-note]");
  const fileInput = document.querySelector("#file-input");
  const fileName = document.querySelector("[data-file-name]");
  const boardTitle = document.querySelector("[data-write-board]");
  const threadTitle = document.querySelector("[data-write-thread]");
  const threadLink = document.querySelector("[data-thread-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!form) return;

  if (!board || !threadId) {
    if (note) note.textContent = "スレッドが見つかりません。";
    form.querySelector("button").disabled = true;
    return;
  }

  const thread = board.threads.find((item) => item.id === threadId);
  if (!thread) {
    if (note) note.textContent = "スレッドが見つかりません。";
    form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = board.name;
  if (threadTitle) threadTitle.textContent = `└ ${thread.title}`;
  if (threadLink) threadLink.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
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
    let fileName = "";
    let imageData = "";
    if (file && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        if (note) note.textContent = "添付ファイルは5MB以内にしてください。";
        return;
      }
      fileName = file.name;
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
        console.error("画像の読み込みに失敗しました。", error);
        if (note) note.textContent = "画像の読み込みに失敗しました。";
        return;
      }
    }

    const now = Date.now();
    const { name, trip } = parseNameWithTrip(formData.get("name"));
    const author = getAuthorKey(name, trip);
    const post = {
      id: now,
      name,
      trip,
      author,
      email: sanitizeText(formData.get("email") || ""),
      message,
      createdAt: now,
      ua: getDeviceType(navigator.userAgent || ""),
      delpass: sanitizeText(formData.get("delpass") || ""),
      fileName,
      imageData
    };

    thread.posts.push(post);
    await saveData(data);
    window.location.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
  });
};

const renderNewThreadPage = async () => {
  const page = document.querySelector("[data-new-thread-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const data = await loadData();
  const board = boardId ? data.boards?.[boardId] : null;
  const form = document.querySelector("[data-new-thread-form]");
  const note = document.querySelector("[data-new-thread-note]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!form) return;

  if (!board) {
    if (note) note.textContent = "掲示板が見つかりません。";
    form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = board.name;
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

    const now = Date.now();
    const { name, trip } = parseNameWithTrip(formData.get("name"));
    const author = getAuthorKey(name, trip);
    const thread = {
      id: now,
      title,
      author,
      createdAt: now,
      delpass: sanitizeText(formData.get("delpass") || ""),
      posts: [
        {
          id: now,
          name,
          trip,
          author,
          email: sanitizeText(formData.get("email") || ""),
          message,
          createdAt: now,
          ua: getDeviceType(navigator.userAgent || ""),
          delpass: sanitizeText(formData.get("delpass") || "")
        }
      ]
    };

    board.threads.unshift(thread);
    await saveData(data);
    window.location.href = `./thread.html?board=${boardId}&thread=${thread.id}`;
  });
};

const renderSearchPage = async () => {
  const page = document.querySelector("[data-search-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const data = await loadData();
  const board = boardId ? data.boards?.[boardId] : null;
  const form = document.querySelector("[data-search-form]");
  const results = document.querySelector("[data-search-results]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!form || !results) return;

  if (!board) {
    results.innerHTML = "<li>掲示板が見つかりません。</li>";
    form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) boardTitle.textContent = board.name;
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  const showResults = (keyword) => {
    results.innerHTML = "";
    const normalized = keyword.toLowerCase();
    const matches = board.threads.filter((thread) => {
      if (thread.title.toLowerCase().includes(normalized)) return true;
      return thread.posts.some((post) => post.message.toLowerCase().includes(normalized));
    });

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
      link.textContent = `${thread.title} (${thread.posts.length})`;
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

(async () => {
  await renderThreadList();
  await renderThreadPage();
  await renderWritePage();
  await renderNewThreadPage();
  await renderSearchPage();
  renderConfirmPage();
})();
