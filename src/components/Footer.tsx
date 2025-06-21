'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiGithub, FiTwitter, FiLinkedin, FiMessageSquare } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="bg-muted py-16">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="col-span-1"
          >
            <Link href="/" className="flex items-center mb-4">
              <span className="text-xl font-bold text-primary">Contexto</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-xs">
              Build and deploy Model Context Protocol (MCP) servers without writing a line of code.
            </p>
            <div className="flex space-x-4 mt-6">
              <SocialLink href="https://github.com/contexto" icon={<FiGithub />} label="GitHub" />
              <SocialLink href="https://twitter.com/contexto" icon={<FiTwitter />} label="Twitter" />
              <SocialLink href="https://linkedin.com/company/contexto" icon={<FiLinkedin />} label="LinkedIn" />
              <SocialLink href="https://discord.gg/contexto" icon={<FiMessageSquare />} label="Discord" />
            </div>
          </motion.div>
          
          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="font-semibold mb-4 text-lg">Quick Links</h3>
            <ul className="space-y-2">
              <li><FooterLink href="#features">Features</FooterLink></li>
              <li><FooterLink href="#how-it-works">How It Works</FooterLink></li>
              <li><FooterLink href="#pricing">Pricing</FooterLink></li>
              <li><FooterLink href="#docs">Documentation</FooterLink></li>
              <li><FooterLink href="#changelog">Changelog</FooterLink></li>
            </ul>
          </motion.div>
          
          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="font-semibold mb-4 text-lg">Resources</h3>
            <ul className="space-y-2">
              <li><FooterLink href="#blog">Blog</FooterLink></li>
              <li><FooterLink href="#tutorials">Tutorials</FooterLink></li>
              <li><FooterLink href="#github">GitHub</FooterLink></li>
              <li><FooterLink href="#api-docs">API Reference</FooterLink></li>
              <li><FooterLink href="#community">Community</FooterLink></li>
            </ul>
          </motion.div>
          
          {/* Company */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="font-semibold mb-4 text-lg">Company</h3>
            <ul className="space-y-2">
              <li><FooterLink href="#about">About Us</FooterLink></li>
              <li><FooterLink href="#contact">Contact</FooterLink></li>
              <li><FooterLink href="#careers">Careers</FooterLink></li>
              <li><FooterLink href="#privacy">Privacy Policy</FooterLink></li>
              <li><FooterLink href="#terms">Terms of Service</FooterLink></li>
            </ul>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center"
        >
          <p className="text-muted-foreground text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Contexto. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <FooterLink href="#privacy" small>Privacy</FooterLink>
            <FooterLink href="#terms" small>Terms</FooterLink>
            <FooterLink href="#cookies" small>Cookies</FooterLink>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

interface SocialLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const SocialLink = ({ href, icon, label }: SocialLinkProps) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded-full bg-background text-muted-foreground hover:text-primary hover:bg-background/80 transition-colors"
    >
      {icon}
    </a>
  );
};

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  small?: boolean;
}

const FooterLink = ({ href, children, small = false }: FooterLinkProps) => {
  return (
    <Link 
      href={href} 
      className={`text-muted-foreground hover:text-primary hover:underline transition-colors ${
        small ? 'text-xs' : 'text-sm'
      }`}
    >
      {children}
    </Link>
  );
};

export default Footer;
