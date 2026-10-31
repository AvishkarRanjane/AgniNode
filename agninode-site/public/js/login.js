const $ = s => document.querySelector(s);
(async () => {
  const err = $("#err"), go = () => location.replace("dashboard.html");

  // Handle Demo Quick Access buttons
  document.querySelectorAll("[data-demo], [data-role]").forEach(btn => {
    btn.onclick = () => {
      const r = btn.dataset.demo || btn.dataset.role;
      if (r) {
        sessionStorage.setItem("demoRole", r);
        go();
      }
    };
  });

  if (DEMO) {
    $("#demo").hidden = false;
    $("#real").hidden = true;
    const quick = $("#demo-quick-access");
    if (quick) quick.hidden = true;
    return;
  }

  // Real Firebase Auth
  try {
    const B = "https://www.gstatic.com/firebasejs/10.12.2/";
    const [{initializeApp}, A] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js")]);
    const auth = A.getAuth(initializeApp(CFG));
    A.onAuthStateChanged(auth, u => {
      if (u) {
        sessionStorage.removeItem("demoRole"); // Clear demo mode on real auth
        go();
      }
    });

    $("#real").onsubmit = async e => {
      e.preventDefault();
      err.textContent = "";
      const email = $("#em").value;
      const pwd = $("#pw").value;
      try {
        await A.signInWithEmailAndPassword(auth, email, pwd);
      } catch (ex) {
        // If real auth fails, offer instant demo access or auto-sign in
        const role = email.toLowerCase().includes("admin") ? "admin" : email.toLowerCase().includes("op") ? "operator" : "viewer";
        err.innerHTML = `Authentication failed. <a href="dashboard.html" id="force-demo" style="color:var(--fire-red);text-decoration:underline;font-weight:700;margin-left:6px">Continue as ${role.toUpperCase()} Demo →</a>`;
        sessionStorage.setItem("demoRole", role);
      }
    };

    $("#reset").onclick = async () => {
      if (!$("#em").value) {
        err.textContent = "Please enter your email address first.";
        return;
      }
      try {
        await A.sendPasswordResetEmail(auth, $("#em").value);
        err.textContent = "Password reset email sent! Check your inbox.";
        err.style.color = "var(--status-normal)";
      } catch (ex) {
        err.textContent = "Could not send reset email: " + ex.message;
        err.style.color = "var(--status-alarm)";
      }
    };
  } catch (ex) {
    err.textContent = "Could not load Firebase Auth: " + ex.message;
  }
})();
