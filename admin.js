
const SUPABASE_URL = "https://tkjpfvxchjxuazgtkskw.supabase.co";

const SUPABASE_KEY = "sb_publishable_kWg905MOatFUc4HuScPaTA_8DJAGdtp";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginMessage.textContent = "جارٍ التحقق من البيانات...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.textContent = "تعذر تسجيل الدخول. راجعي البريد وكلمة المرور.";
    return;
  }

  const { data: isAdmin, error: adminError } =
    await supabaseClient.rpc("is_admin");

  if (adminError || isAdmin !== true) {
    await supabaseClient.auth.signOut();

    loginMessage.textContent =
      "هذا الحساب لا يمتلك صلاحيات إدارة البطولة.";

    return;
  }

  loginMessage.textContent = "تم التحقق بنجاح! لوحة التحكم قيد التجهيز.";
});
