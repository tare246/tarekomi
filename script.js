const THREADS_PER_PAGE = 20;
const POSTS_PER_PAGE = 20;
const VALID_BOARDS = new Set(["link1", "link2"]);
const BOARD_INFO = {
  link1: { name: "テーマ話" },
  link2: { name: "馴れ合い" }
};

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
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
  const params = getParams();
  const boardId = params.get("board_id") || params.get("board");
  if (!boardId || !VALID_BOARDS.has(boardId)) return null;
  return boardId;
};

const getThreadIdParam = () => {
  const params = getParams();
  const threadIdRaw = Number(params.get("thread_id") || params.get("thread"));
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

const getSupabaseClient = () => {
  if (!window.supabaseClient) {
    const message = "Supabase クライアントが初期化されていません。";
    console.error(message);
    alert(message);
    return null;
  }
  return window.supabaseClient;
};

const fetchThreadsByBoard = async (boardId) => {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("threads")
    .select("id, board_id, title, author, delpass, created_at")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

const fetchPostsByBoard = async (boardId) => {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("thread_id, message")
    .eq("board_id", boardId);
  if (error) throw error;
  return data ?? [];
};

const fetchThreadById = async (threadId, boardId) => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  let query = supabase
    .from("threads")
    .select("id, board_id, title, author, delpass, created_at")
    .eq("id", threadId);
  if (boardId) {
    query = query.eq("board_id", boardId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

const fetchPostsByThread = async (threadId, boardId) => {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  let query = supabase
    .from("posts")
    .select("id, board_id, thread_id, name, trip, author, message, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (boardId) {
    query = query.eq("board_id", boardId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

const renderThreadList = async () => {
  const boardId = document.body.dataset.board;
  if (!boardId || !VALID_BOARDS.has(boardId)) return;
  const list = document.querySelector("[data-thread-list]");
  const header = document.querySelector(".thread-head__title");
  const pagers = Array.from(document.querySelectorAll("[data-thread-pager]"));

  if (!list) return;

  list.innerHTML = "";

  try {
    const [threads, posts] = await Promise.all([
      fetchThreadsByBoard(boardId),
      fetchPostsByBoard(boardId)
    ]);

    if (header) {
      header.textContent = `スレ一覧 (${threads.length}件)`;
    }

    if (threads.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "スレッドがありません。";
      list.appendChild(empty);
      return;
    }

    const counts = posts.reduce((map, post) => {
      const key = post.thread_id;
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());

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
      link.href = `./thread.html?board_id=${boardId}&thread_id=${thread.id}`;
      link.textContent = `${thread.title} (${counts.get(thread.id) || 0})`;
      item.appendChild(link);
      list.appendChild(item);
    });
  } catch (error) {
    console.error("スレッド一覧の取得に失敗しました", error);
    alert("スレッド一覧の取得に失敗しました。");
  }
};

const renderThreadPage = async () => {
  const pageRoot = document.querySelector("[data-thread-page]");
  if (!pageRoot) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();

  const boardTitle = document.querySelector("[data-thread-board]");
  const threadTitle = document.querySelector("[data-thread-title]");
  const postsRoot = document.querySelector("[data-posts]");
  const threadActions = document.querySelector("[data-thread-actions]");
  const writeLinks = document.querySelectorAll("[data-write-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");
  const pagers = Array.from(document.querySelectorAll("[data-post-pager]"));

  if (!postsRoot) return;

  if (!threadId) {
    postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
    return;
  }

  try {
    const [thread, posts] = await Promise.all([
      fetchThreadById(threadId, boardId),
      fetchPostsByThread(threadId, boardId)
    ]);

    if (!thread) {
      postsRoot.innerHTML = "<p>スレッドが見つかりません。</p>";
      return;
    }

    if (boardTitle) {
      boardTitle.textContent = BOARD_INFO[thread.board_id]?.name || "スレ一覧";
    }
    if (threadTitle) threadTitle.textContent = thread.title;

    if (threadActions) {
      threadActions.innerHTML = "";
    }

    writeLinks.forEach((link) => {
      link.href = `./write.html?board_id=${thread.board_id}&thread_id=${thread.id}`;
    });

    boardLinks.forEach((link) => {
      link.href = `./${thread.board_id}.html`;
    });

    postsRoot.innerHTML = "";

    const currentPage = getPageParam();
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const pageIndex = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const baseParams = new URLSearchParams({ board_id: thread.board_id, thread_id: thread.id });

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

    const imageViewer = setupImageViewer();

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
      meta.textContent = formatDate(post.created_at);

      const body = document.createElement("div");
      body.className = "post__body";
      renderBodyWithLinks(message, body);

      const media = document.createElement("div");
      media.className = "post__media";
      extractYouTubeIds(message).forEach((videoId) => {
        media.appendChild(createYouTubeEmbed(videoId));
      });

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

      if (post.ua) {
        const ua = document.createElement("div");
        ua.className = "post__ua";
        ua.textContent = normalizeDeviceType(post.ua);
        article.appendChild(ua);
      }

      postsRoot.appendChild(article);

      if (index !== pagePosts.length - 1) {
        const divider = document.createElement("hr");
        divider.className = "rule rule-tight";
        postsRoot.appendChild(divider);
      }
    });
  } catch (error) {
    console.error("スレッド取得に失敗しました。", error);
    alert("スレッドの取得に失敗しました。");
  }
};

const renderWritePage = () => {
  const page = document.querySelector("[data-write-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const threadId = getThreadIdParam();
  const form = document.querySelector("[data-write-form]");
  const note = document.querySelector("[data-write-note]");
  const fileInput = document.querySelector("#file-input");
  const fileName = document.querySelector("[data-file-name]");
  const boardTitle = document.querySelector("[data-write-board]");
  const threadTitle = document.querySelector("[data-write-thread]");
  const threadLink = document.querySelector("[data-thread-link]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId || !threadId) {
    if (note) note.textContent = "スレッドが見つかりません。";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  const init = async () => {
    try {
      const thread = await fetchThreadById(threadId, boardId);
      if (!thread) {
        if (note) note.textContent = "スレッドが見つかりません。";
        if (form) form.querySelector("button").disabled = true;
        return;
      }

      if (boardTitle) {
        boardTitle.textContent = BOARD_INFO[thread.board_id]?.name || "スレ一覧";
      }
      if (threadTitle) threadTitle.textContent = `└ ${thread.title}`;
      if (threadLink) {
        threadLink.href = `./thread.html?board_id=${thread.board_id}&thread_id=${thread.id}`;
      }
      boardLinks.forEach((link) => {
        link.href = `./${thread.board_id}.html`;
      });
    } catch (error) {
      console.error("スレッド情報の取得に失敗しました。", error);
      alert("スレッド情報の取得に失敗しました。");
      if (note) note.textContent = "スレッド情報の取得に失敗しました。";
      if (form) form.querySelector("button").disabled = true;
    }
  };

  init();

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
    if (file && file.size > 0) {
      if (note) note.textContent = "添付ファイルは現在未対応です。";
      return;
    }

    const { name, trip } = parseNameWithTrip(formData.get("name"));
    const author = getAuthorKey(name, trip);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { error } = await supabase.from("posts").insert({
        board_id: boardId,
        thread_id: threadId,
        name,
        trip,
        author,
        message
      });
      if (error) throw error;
      window.location.href = `./thread.html?board_id=${boardId}&thread_id=${threadId}`;
    } catch (error) {
      console.error("投稿に失敗しました。", error);
      alert("投稿に失敗しました。");
      if (note) note.textContent = "投稿に失敗しました。";
    }
  });
};

const renderNewThreadPage = () => {
  const page = document.querySelector("[data-new-thread-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const form = document.querySelector("[data-new-thread-form]");
  const note = document.querySelector("[data-new-thread-note]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId) {
    if (note) note.textContent = "掲示板が見つかりません。";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) {
    boardTitle.textContent = BOARD_INFO[boardId]?.name || "スレ一覧";
  }
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
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: thread, error: threadError } = await supabase
        .from("threads")
        .insert({
          board_id: boardId,
          title,
          author,
          delpass: delpass || null
        })
        .select("id")
        .single();

      if (threadError) throw threadError;

      const { error: postError } = await supabase.from("posts").insert({
        board_id: boardId,
        thread_id: thread.id,
        name,
        trip,
        author,
        message
      });

      if (postError) throw postError;

      window.location.href = `./thread.html?board_id=${boardId}&thread_id=${thread.id}`;
    } catch (error) {
      console.error("スレッド作成に失敗しました。", error);
      alert("スレッド作成に失敗しました。");
      if (note) note.textContent = "スレッド作成に失敗しました。";
    }
  });
};

const renderSearchPage = () => {
  const page = document.querySelector("[data-search-page]");
  if (!page) return;

  const boardId = getBoardIdParam();
  const form = document.querySelector("[data-search-form]");
  const results = document.querySelector("[data-search-results]");
  const boardTitle = document.querySelector("[data-write-board]");
  const boardLinks = document.querySelectorAll("[data-board-link]");

  if (!boardId) {
    if (results) results.innerHTML = "<li>掲示板が見つかりません。</li>";
    if (form) form.querySelector("button").disabled = true;
    return;
  }

  if (boardTitle) {
    boardTitle.textContent = BOARD_INFO[boardId]?.name || "スレ一覧";
  }
  boardLinks.forEach((link) => {
    link.href = `./${boardId}.html`;
  });

  const showResults = async (keyword) => {
    results.innerHTML = "";
    const normalized = keyword.toLowerCase();

    try {
      const [threads, posts] = await Promise.all([
        fetchThreadsByBoard(boardId),
        fetchPostsByBoard(boardId)
      ]);

      const postsByThread = posts.reduce((map, post) => {
        if (!map.has(post.thread_id)) {
          map.set(post.thread_id, []);
        }
        map.get(post.thread_id).push(post);
        return map;
      }, new Map());

      const matches = threads.filter((thread) => {
        if ((thread.title || "").toLowerCase().includes(normalized)) return true;
        const threadPosts = postsByThread.get(thread.id) || [];
        return threadPosts.some((post) => (post.message || "").toLowerCase().includes(normalized));
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
        link.href = `./thread.html?board_id=${boardId}&thread_id=${thread.id}`;
        link.textContent = `${thread.title} (${(postsByThread.get(thread.id) || []).length})`;
        item.appendChild(link);
        results.appendChild(item);
      });
    } catch (error) {
      console.error("検索に失敗しました。", error);
      alert("検索に失敗しました。");
      const item = document.createElement("li");
      item.textContent = "検索に失敗しました。";
      results.appendChild(item);
    }
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

console.log("✅ script.js loaded:", location.pathname);
