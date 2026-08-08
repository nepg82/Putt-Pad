(() => {
  "use strict";

  const DOT_COLORS = [
    "#F4B740",
    "#F6F1E4",
    "#BFE3CC",
    "#E88C7D",
    "#D8C08A",
    "#9CC6A6",
  ];

  window.exportResults = async function () {
    const state = window.getPuttPadState?.();
    if (!state?.active) return;

    const canvas = buildScorecardCanvas(state);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File(
        [blob],
        "putt-pad-results.png",
        { type: "image/png" }
      );

      // Prefer native sharing when available.
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            title: "Putt Pad Results",
            text: state.courseName || "Putt Pad Results",
            files: [file],
          });
          return;
        } catch (err) {
          // User cancelled sharing — don't download unexpectedly.
          if (err?.name === "AbortError") return;
        }
      }

      // Fallback: download the PNG.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "putt-pad-results.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  function buildScorecardCanvas(state) {
    const width = 1200;
    const rowHeight = 58;
    const headerHeight = 150;
    const footerHeight = 80;
    const height = headerHeight + rowHeight * (state.players.length + 2) + footerHeight;

    const canvas = document.createElement("canvas");
    const scale = 2;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = "#1E1E1E";
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.fillStyle = "#F4B740";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("PUTT PAD", 60, 58);

    ctx.fillStyle = "#F6F1E4";
    ctx.font = "28px sans-serif";
    ctx.fillText(state.courseName || "Mini Golf Round", 60, 105);

    const holes = state.holes;
    const labelWidth = 190;
    const totalWidth = 100;
    const usableWidth = width - 120 - labelWidth - totalWidth;
    const holeWidth = usableWidth / holes;

    const tableTop = headerHeight;

    // Header row
    ctx.fillStyle = "#F4B740";
    ctx.fillRect(60, tableTop, width - 120, rowHeight);

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Hole", 80, tableTop + 37);

    for (let i = 0; i < holes; i++) {
      centerText(
        ctx,
        String(i + 1),
        60 + labelWidth + holeWidth * i + holeWidth / 2,
        tableTop + 37
      );
    }

    centerText(
      ctx,
      "Tot",
      width - 60 - totalWidth / 2,
      tableTop + 37
    );

    // Par row
    drawRowBackground(ctx, tableTop + rowHeight, false);

    ctx.fillStyle = "#F6F1E4";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Par", 80, tableTop + rowHeight + 37);

    let parTotal = 0;

    for (let i = 0; i < holes; i++) {
      const par = state.pars[i] ?? 3;
      parTotal += par;

      centerText(
        ctx,
        String(par),
        60 + labelWidth + holeWidth * i + holeWidth / 2,
        tableTop + rowHeight + 37
      );
    }

    centerText(
      ctx,
      String(parTotal),
      width - 60 - totalWidth / 2,
      tableTop + rowHeight + 37
    );

let leaderId = null;
let leaderTotal = Infinity;

state.players.forEach((player) => {
  const scores = state.scores[player.id] || [];
  const played = scores.filter((score) => score != null);

  if (played.length > 0) {
    const total = played.reduce((sum, score) => sum + score, 0);

    if (total < leaderTotal) {
      leaderTotal = total;
      leaderId = player.id;
    }
  }
});
    
    // Player rows
    state.players.forEach((player, playerIndex) => {
      const y = tableTop + rowHeight * (playerIndex + 2);
      drawRowBackground(ctx, y, playerIndex % 2 === 0);

      const color = DOT_COLORS[playerIndex % DOT_COLORS.length];

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(94, y + rowHeight / 2, 17, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1E1E1E";
      ctx.font = "bold 12px sans-serif";
      centerText(
        ctx,
        initials(player.name),
        94,
        y + rowHeight / 2 + 4
      );

      ctx.fillStyle = "#F6F1E4";
      ctx.font = "bold 21px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(player.name, 122, y + 37);

if (state.players.length > 1 && player.id === leaderId) {
  ctx.font = "22px sans-serif";
  ctx.fillText("🏆", 122 + ctx.measureText(player.name).width + 12, y + 37);
}

      let total = 0;
      let played = false;

      for (let i = 0; i < holes; i++) {
        const score = state.scores[player.id]?.[i];

        if (score != null) {
          total += score;
          played = true;
        }

        centerText(
          ctx,
          score == null ? "–" : String(score),
          60 + labelWidth + holeWidth * i + holeWidth / 2,
          y + 37
        );
      }

      centerText(
        ctx,
        played ? String(total) : "–",
        width - 60 - totalWidth / 2,
        y + 37
      );
    });

    // Footer
    const footerY =
      tableTop + rowHeight * (state.players.length + 2) + 35;

    ctx.fillStyle = "#8F8F8F";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Putt Pad", 60, footerY);

    return canvas;
  }

  function drawRowBackground(ctx, y, alternate) {
    ctx.fillStyle = alternate ? "#292929" : "#242424";
    ctx.fillRect(60, y, ctx.canvas.width / 2 - 60, 58);
    ctx.fillRect(ctx.canvas.width / 2, y, ctx.canvas.width / 2 - 60, 58);
  }

  function centerText(ctx, text, x, y) {
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
  }

  function initials(name) {
    return name.trim().slice(0, 2).toUpperCase();
  }
})();
