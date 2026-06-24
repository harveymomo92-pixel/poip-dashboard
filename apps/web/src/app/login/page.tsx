import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <span className="brand-mark">P</span>
        <p className="eyebrow" style={{ marginTop: 18 }}>PPIC Output Intelligence</p>
        <h1>Masuk ke workspace</h1>
        <p className="page-description">Pantau output, target, reject, downtime, dan kualitas data dalam satu ruang operasi.</p>
        <LoginForm />
      </section>
    </main>
  );
}
