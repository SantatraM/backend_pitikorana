import "dotenv/config";
import { createSupabaseAdminClient } from "../src/lib/supabaseAdmin.js";

const TEST_MEMBER_AUTH_USER_ID = "7dfb65f0-cc26-4f08-b213-08644447ecd4";
const newPassword = process.env.TEST_MEMBER_NEW_PASSWORD;

if (typeof newPassword !== "string" || !newPassword) {
  console.error("La variable TEST_MEMBER_NEW_PASSWORD est requise.");
  process.exitCode = 1;
} else {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      TEST_MEMBER_AUTH_USER_ID,
      { password: newPassword },
    );

    if (error) throw error;

    console.log("Mot de passe du MEMBRE de test mis à jour.");
  } catch {
    console.error("Impossible de mettre à jour le mot de passe du MEMBRE de test.");
    process.exitCode = 1;
  }
}
