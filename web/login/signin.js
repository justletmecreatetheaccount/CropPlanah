/* =========================================
   Solvine Commons // signin.js
   The signup form is a list. To extend it,
   add one object to SIGNUP_FIELDS below:
   no HTML needs to be touched.

   Supported field types:
     text, email, password, number, textarea, select

   Optional keys:
     required, placeholder, hint, unit (shown after
     the label, e.g. "kcal/day"), min, max,
     options (list for type "select")
   ========================================= */

const SIGNUP_FIELDS = [
  {
    name: "name",
    label: "Full name",
    type: "text",
    required: true,
    placeholder: "Lina Devos",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    placeholder: "lina@solvine.mesh",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    required: true,
    hint: "min. 8 characters",
  },
  {
    name: "kcal",
    label: "Personal calories requirements",
    type: "number",
    unit: "kcal/day",
    min: 1200,
    max: 5000,
    required: true,
    hint: "feeds the nutrition ledger, adjust it whenever",
  },
];

/* =========================================
   field renderer: builds the markup for one entry
   ========================================= */

function makeField(f) {
  const wrap = document.createElement("div");
  wrap.className = "field";

  const label = document.createElement("label");
  label.setAttribute("for", `su-${f.name}`);
  label.textContent = f.label;
  if (f.required) {
    const star = document.createElement("span");
    star.className = "req";
    star.textContent = " *";
    star.setAttribute("aria-hidden", "true");
    label.appendChild(star);
  }
  if (f.unit) {
    const unit = document.createElement("span");
    unit.className = "field-unit";
    unit.textContent = `(${f.unit})`;
    label.appendChild(unit);
  }
  wrap.appendChild(label);

  let input;
  if (f.type === "textarea") {
    input = document.createElement("textarea");
    input.rows = 3;
  } else if (f.type === "select") {
    input = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "-- choose --";
    input.appendChild(blank);
    (f.options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      input.appendChild(o);
    });
  } else {
    input = document.createElement("input");
    input.type = f.type;
  }

  input.id = `su-${f.name}`;
  input.name = f.name;
  if (f.placeholder) input.placeholder = f.placeholder;
  if (f.required) input.required = true;
  if (f.min !== undefined) input.min = f.min;
  if (f.max !== undefined) input.max = f.max;
  input.autocomplete = "off";
  wrap.appendChild(input);

  if (f.hint) {
    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.textContent = f.hint;
    wrap.appendChild(hint);
  }

  return wrap;
}

/* =========================================
   form wiring
   ========================================= */

function showStatus(el, message, ok) {
  el.hidden = false;
  el.className = `form-status ${ok ? "is-ok" : "is-error"}`;
  el.textContent = message;
}

function readValues(form, fields) {
  const values = {};
  const missing = [];
  fields.forEach((f) => {
    const input = form.elements[f.name];
    const value = input ? input.value.trim() : "";
    values[f.name] = value;
    if (f.required && !value) missing.push(f.label);
  });
  return { values, missing };
}

// signup form: render the list, then wire the submit
const signupForm = document.getElementById("signup-form");
SIGNUP_FIELDS.forEach((f) => signupForm.appendChild(makeField(f)));

const signupSubmit = document.createElement("button");
signupSubmit.type = "submit";
signupSubmit.className = "btn btn-submit";
signupSubmit.textContent = "Join the Community";
signupForm.appendChild(signupSubmit);

const signupStatus = document.createElement("p");
signupStatus.className = "form-status";
signupStatus.hidden = true;
signupForm.appendChild(signupStatus);

signupForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const { values, missing } = readValues(signupForm, SIGNUP_FIELDS);

  if (missing.length > 0) {
    showStatus(signupStatus, `Missing: ${missing.join(" / ")}.`, false);
    return;
  }

  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: values.name,
      email: values.email,
      password: values.password,
      kcal_per_day: values.kcal,
    }),
  });

  if (response.ok) {
    window.location = "/community"; // signup endpoint logs you in too
  } else {
    const data = await response.json();
    showStatus(signupStatus, data.error, false);
  }
});

// signupForm.addEventListener("submit", (ev) => {
//   ev.preventDefault();
//   const { values, missing } = readValues(signupForm, SIGNUP_FIELDS);

//   if (missing.length > 0) {
//     showStatus(signupStatus, `Missing: ${missing.join(" / ")}.`, false);
//     return;
//   }

//   const calories = values.calories
//     ? `${values.calories} kcal/day`
//     : "no target yet";
//   showStatus(
//     signupStatus,
//     `Welcome, ${values.name}. Plot ${values.plot || "to be assigned"}, ${calories}. ` +
//       `No server is wired to this page yet - the values stayed right here in this form.`,
//     true,
//   );
// });

// login form: static in the HTML, simple check
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const { values, missing } = readValues(loginForm, [
    { name: "email", label: "Email", required: true },
    { name: "password", label: "Password", required: true },
  ]);

  if (missing.length > 0) {
    showStatus(loginStatus, `Missing: ${missing.join(" / ")}.`, false);
    return;
  }

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: values.email, password: values.password }),
  });

  if (response.ok) {
    window.location = "/community"; // cookie rides along automatically
  } else {
    const data = await response.json();
    showStatus(loginStatus, data.error, false);
  }
});

// loginForm.addEventListener("submit", (ev) => {
//   ev.preventDefault();
//   const { missing } = readValues(loginForm, [
//     { name: "email", label: "Email", required: true },
//     { name: "password", label: "Password", required: true },
//   ]);

//   if (missing.length > 0) {
//     showStatus(loginStatus, `Missing: ${missing.join(" / ")}.`, false);
//     return;
//   }

//   showStatus(
//     loginStatus,
//     "Handshake received. No server is wired to this page yet - hook it to the node root.",
//     true,
//   );
// });
