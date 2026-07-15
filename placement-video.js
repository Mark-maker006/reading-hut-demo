(function () {
  const page = document.querySelector(".video-page");
  const video = document.querySelector(".placement-video");

  if (!page || !video) {
    return;
  }

  const showSuccess = () => {
    page.classList.add("is-success");
    video.pause();
  };

  const playFromStart = () => {
    page.classList.remove("is-success");
    video.currentTime = 0;

    const playResult = video.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        page.addEventListener("click", () => video.play(), { once: true });
      });
    }
  };

  video.addEventListener("ended", showSuccess);
  video.addEventListener("error", () => {
    page.classList.add("is-success");
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", playFromStart, { once: true });
  } else {
    playFromStart();
  }
})();
