import { Link } from "react-router";
import { AuthLayout } from "../components/layout/AuthLayout";
import { LoginForm } from "../features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout
      footer={
        <>
          No account yet? <Link to="/signup" className="text-link hover:text-[#8bb8f8]">Create an instance</Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
