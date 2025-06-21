'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import { motion } from 'framer-motion';

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-background/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="container flex items-center justify-between py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col"
          >
            <div className="flex items-center">
              <img src="/contexto-logo.svg" alt="Contexto Logo" className="h-8 mr-2" />
            </div>
            <span className="block text-xs text-muted-foreground mt-0.5">Your data. Your context. No code.</span>
          </motion.div>
        </Link>

        {/* Desktop Navigation */}
        <motion.nav 
          className="hidden md:flex items-center space-x-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#how-it-works">How It Works</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
          <NavLink href="#docs">Docs</NavLink>
          <NavLink href="#signin">Sign In</NavLink>
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-muted transition-colors duration-200"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <FiSun className="w-5 h-5 text-yellow-300" />
            ) : (
              <FiMoon className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </motion.nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button 
            onClick={toggleTheme}
            className="p-2 mr-2 rounded-full hover:bg-muted transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <FiSun className="w-5 h-5 text-yellow-300" />
            ) : (
              <FiMoon className="w-5 h-5 text-slate-700" />
            )}
          </button>
          <button
            className="p-2 rounded-md hover:bg-muted transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <FiX className="w-6 h-6" />
            ) : (
              <FiMenu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div 
          className="md:hidden bg-background border-t border-border"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="container py-4 flex flex-col space-y-4">
            <MobileNavLink href="#features" onClick={() => setIsMobileMenuOpen(false)}>Features</MobileNavLink>
            <MobileNavLink href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>How It Works</MobileNavLink>
            <MobileNavLink href="#pricing" onClick={() => setIsMobileMenuOpen(false)}>Pricing</MobileNavLink>
            <MobileNavLink href="#docs" onClick={() => setIsMobileMenuOpen(false)}>Docs</MobileNavLink>
            <MobileNavLink href="#signin" onClick={() => setIsMobileMenuOpen(false)}>Sign In</MobileNavLink>
          </div>
        </motion.div>
      )}
    </header>
  );
};

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavLink = ({ href, children }: NavLinkProps) => {
  return (
    <Link 
      href={href} 
      className="text-foreground/80 hover:text-primary font-medium transition-colors duration-200"
    >
      {children}
    </Link>
  );
};

const MobileNavLink = ({ href, children, onClick }: NavLinkProps) => {
  return (
    <Link 
      href={href} 
      className="block py-2 text-foreground/80 hover:text-primary font-medium transition-colors duration-200"
      onClick={onClick}
    >
      {children}
    </Link>
  );
};

export default Header;
