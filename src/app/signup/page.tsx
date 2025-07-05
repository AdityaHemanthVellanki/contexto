'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaGoogle } from 'react-icons/fa';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle, signUpWithEmail, user } = useAuth();
  const router = useRouter();

  // If user is already signed in, redirect to dashboard
  if (user) {
    router.push('/dashboard');
    return null;
  }

  const handleEmailSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate form inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signUpWithEmail(email, password);
      
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      // Successful signup
      router.push('/dashboard');
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      // Redirect happens in the signInWithGoogle function
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
      console.error(err);
      setIsLoading(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h2 className="text-3xl font-bold text-primary">Contexto</h2>
          </Link>
          <h1 className="text-2xl font-semibold mt-6 mb-2">Create your account</h1>
          <p className="text-foreground/70">Join Contexto to start your AI-powered journey</p>
        </motion.div>

        {error && (
          <motion.div
            variants={itemVariants}
            className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md text-sm"
          >
            {error}
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-gray-200 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200 mb-4 disabled:opacity-60"
          >
            <FaGoogle className="text-[#4285F4]" />
            <span>Sign in with Google</span>
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </motion.div>

        <motion.form variants={itemVariants} onSubmit={handleEmailSignUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all duration-200"
              placeholder="you@example.com"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-md bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-60"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </motion.button>
        </motion.form>

        <motion.p variants={itemVariants} className="mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/signin" className="font-medium text-primary hover:text-primary-dark">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
