"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name
      await updateProfile(user, { displayName: name });

      // Save additional info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        info: {
          name,
          email,
          createdAt: new Date().toISOString(),
        }
      });

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-container auth-form">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join us and start taking beautiful notes</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSignup} className="auth-form">
          <div className="input-group">
            <label className="input-label" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              className="glass-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="glass-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="glass-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          <button type="submit" className="btn-primary">Sign Up</button>
        </form>
        
        <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
