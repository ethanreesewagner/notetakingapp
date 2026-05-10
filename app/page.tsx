"use client";

import TiptapEditor from "../components/TiptapEditor";
import { useAuth } from "../lib/auth";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserInfo() {
      if (user) {
        // We can use user.displayName directly, or fetch from Firestore to verify.
        // Let's use Firestore to fulfill the Notion-like info retrieval logic.
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserName(docSnap.data()?.info?.name || user.displayName);
          } else {
            setUserName(user.displayName);
          }
        } catch (e) {
          setUserName(user.displayName);
        }
      }
    }
    fetchUserInfo();
  }, [user]);

  if (loading) {
    return (
      <div className="auth-wrapper">
        <div className="glass-container" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      <header className="glass-container" style={{ width: '100%', maxWidth: '800px', display: 'flex', justifySelf: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Notion Clone</h1>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Welcome, {userName || user.email}
            </span>
            <button onClick={handleSignOut} className="btn-primary" style={{ marginTop: 0, padding: '0.5rem 1rem' }}>Sign Out</button>
          </div>
        ) : (
          <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', marginTop: 0, padding: '0.5rem 1rem' }}>
            Sign In
          </Link>
        )}
      </header>

      <TiptapEditor />
      
    </main>
  );
}
