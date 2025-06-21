'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';

const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const pricingTiers = [
    {
      name: 'Free',
      price: { monthly: '$0', yearly: '$0' },
      description: 'Perfect for personal projects and exploration',
      features: [
        'Up to 3 MCP servers',
        '100MB document storage',
        '10,000 tokens/day',
        'Basic embedding models',
        'Community support',
      ],
      buttonText: 'Start Free',
      buttonAccent: false,
      highlight: false,
    },
    {
      name: 'Pro',
      price: { monthly: '$19', yearly: '$190' },
      description: 'For professionals and growing businesses',
      features: [
        'Up to 10 MCP servers',
        '5GB document storage',
        '1M tokens/day',
        'Premium embedding models',
        'Private deployments',
        'Email support',
        'Custom chunk sizing',
      ],
      buttonText: 'Upgrade to Pro',
      buttonAccent: true,
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: { monthly: 'Contact Us', yearly: 'Contact Us' },
      description: 'Tailored solutions for large organizations',
      features: [
        'Unlimited MCP servers',
        'Unlimited storage',
        'Custom token limits',
        'Custom embedding models',
        'Dedicated hosting',
        'SLA & 24/7 support',
        'API access',
        'SSO & team management',
      ],
      buttonText: 'Contact Sales',
      buttonAccent: false,
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Choose the plan that works best for your needs
          </motion.p>

          {/* Billing period selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex justify-center mt-8 mb-12"
          >
            <div className="inline-flex bg-muted/70 p-1 rounded-lg">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                Yearly <span className="text-green-500 text-xs font-normal">Save 20%</span>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pricingTiers.map((tier, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              className={`
                card relative overflow-hidden 
                ${tier.highlight ? 'border-primary ring-1 ring-primary' : ''} 
              `}
            >
              {tier.highlight && (
                <div className="absolute top-0 right-0">
                  <div className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-bl">
                    Popular
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {tier.price[billingPeriod]}
                  </span>
                  {tier.price[billingPeriod] !== 'Contact Us' && (
                    <span className="text-muted-foreground text-sm">
                      /{billingPeriod === 'monthly' ? 'month' : 'year'}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2 text-sm">{tier.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <FiCheck className="mr-2 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 px-4 rounded-md font-medium transition-all duration-300 ${
                  tier.buttonAccent
                    ? 'bg-primary hover:bg-primary-dark text-white animate-pulse-gentle'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
                aria-label={`Select ${tier.name} plan`}
              >
                {tier.buttonText}
              </button>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground text-sm">
            Need a custom plan? <a href="#contact" className="text-primary hover:underline">Contact our sales team</a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
