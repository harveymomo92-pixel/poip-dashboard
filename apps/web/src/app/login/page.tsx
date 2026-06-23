import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <p className="eyebrow">PPIC Output Intelligence</p>
        <h1>Login</h1>
        <LoginForm />
      </section>
    </main>
  );
}
