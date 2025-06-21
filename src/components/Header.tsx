'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import { motion, Variants, Variant, TargetAndTransition, Transition } from 'framer-motion';

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

  // Animation variants for enhanced micro-interactions
  const headerVariants: Variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Type-safe implementation for variants with custom parameter
  const createNavItemVariants = (i: number): TargetAndTransition => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.05 * i,
      duration: 0.5,
      ease: "easeOut"
    },
  });

  const logoVariants: Variants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.5,
        type: "spring",
        stiffness: 100
      } 
    },
    hover: { scale: 1.05, transition: { duration: 0.2 } },
  };

  // Add floating beta badge
  const BetaBadge = () => (
    <motion.div
      className="floating-badge"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, duration: 0.5 }}
    >
      Now in Beta
    </motion.div>
  );

  return (
    <>
      <motion.header 
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'glass border-b border-white/10 shadow-glass' 
            : 'bg-transparent'
        }`}
      >
        <div className="container flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <motion.div 
              variants={logoVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              className="flex flex-col"
            >
              <div className="flex items-center">
                <img 
                  src="/contexto-logo.svg" 
                  alt="Contexto Logo" 
                  className="h-8 mr-2 glow-on-hover group-hover:animate-pulse-gentle" 
                />
              </div>
              <span className="block text-xs text-muted-foreground mt-0.5 transition-opacity group-hover:text-primary">Your data. Your context. No code.</span>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <motion.nav 
            className="hidden md:flex items-center space-x-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {['features', 'how-it-works', 'pricing', 'docs', 'signin'].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: -10 }}
                animate={createNavItemVariants(i)}
              >
                <NavLink href={`#${item}`}>
                  {item === 'signin' ? 'Sign In' :
                   item === 'how-it-works' ? 'How It Works' :
                   item.charAt(0).toUpperCase() + item.slice(1)}
                </NavLink>
              </motion.div>
            ))}
            
            {/* Theme Toggle */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-muted/50 transition-all duration-200 rotate-icon"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <motion.div
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FiSun className="w-5 h-5 text-yellow-300" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ rotate: 180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -180, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FiMoon className="w-5 h-5 text-slate-700" />
                </motion.div>
              )}
            </motion.button>
          </motion.nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2 mr-2 rounded-full hover:bg-muted/50 transition-all duration-200 rotate-icon"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <FiSun className="w-5 h-5 text-yellow-300" />
              ) : (
                <FiMoon className="w-5 h-5 text-slate-700" />
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-md hover:bg-muted/50 transition-all duration-200"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <motion.div
                  initial={{ rotate: -90 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.div>
              ) : (
                <FiMenu className="w-6 h-6" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <motion.div 
          className={`mobile-menu md:hidden ${isMobileMenuOpen ? '' : 'hidden'} bg-card/95 backdrop-blur-lg border-t border-border shadow-lg`}
          initial={{ opacity: 0, height: 0 }}
          animate={isMobileMenuOpen ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="container py-4 flex flex-col space-y-4">
            {['features', 'how-it-works', 'pricing', 'docs', 'signin'].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
              >
                <MobileNavLink href={`#${item}`} onClick={() => setIsMobileMenuOpen(false)}>
                  {item === 'signin' ? 'Sign In' :
                   item === 'how-it-works' ? 'How It Works' :
                   item.charAt(0).toUpperCase() + item.slice(1)}
                </MobileNavLink>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.header>
      
      {/* Beta Badge */}
      <BetaBadge />
    </>
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
      className="nav-link font-medium"
    >
      {children}
    </Link>
  );
};

const MobileNavLink = ({ href, children, onClick }: NavLinkProps) => {
  return (
    <Link 
      href={href} 
      className="block py-2 nav-link font-medium relative overflow-hidden group"
      onClick={onClick}
    >
      <span className="relative z-10">{children}</span>
      <motion.span 
        className="absolute bottom-0 left-0 w-0 h-full bg-primary/5 -z-10"
        whileHover={{ width: '100%' }}
        transition={{ duration: 0.2 }}
      />
    </Link>
  );
};

export default Header;
