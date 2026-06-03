"use client";
/* eslint-disable react/no-unescaped-entities -- generated demo page; apostrophes/quotes in marketing copy are intentional */

import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';


gsap.registerPlugin(ScrollTrigger);
const AuroraIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 4C16 4 8 12 8 20C8 24.4183 11.5817 28 16 28C20.4183 28 24 24.4183 24 20C24 12 16 4 16 4Z" stroke="#E8E8EF" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 16C12 16 16 12 20 16" stroke="#818CF8" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const AccountIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="M3 10h18"/>
    <circle cx="7" cy="15" r="1"/>
  </svg>
);

const BookkeepIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const TreasuryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

const CardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <path d="M2 10h20"/>
    <path d="M6 15h4"/>
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="M18 9l-5 5-4-4-3 3"/>
  </svg>
);

const AutomateIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8l3 3 7-7"/>
  </svg>
);

const features = [
  { icon: AccountIcon, title: "Instant Account Opening", desc: "Launch your business banking in under 5 minutes. No paperwork, no branch visits, no waiting." },
  { icon: BookkeepIcon, title: "AI-Powered Bookkeeping", desc: "Every transaction automatically categorized and reconciled. Your books are always audit-ready." },
  { icon: TreasuryIcon, title: "Smart Treasury", desc: "Put your cash to work with AI-driven yield optimization across FDIC-insured instruments." },
  { icon: CardIcon, title: "Corporate Card Controls", desc: "Set granular spending limits, merchant categories, and time-based restrictions per team member." },
  { icon: AnalyticsIcon, title: "Real-time Cash Flow", desc: "Predictive analytics surface payment timing, seasonal patterns, and margin risks before they hit." },
  { icon: AutomateIcon, title: "Expense Automation", desc: "Receipt scanning, mileage tracking, and per-diem calculations — all done before you finish your coffee." },
];

const stats = [
  { value: 180, suffix: "s", label: "Account opening time" },
  { value: 94, suffix: "%", label: "Automation rate" },
  { value: 2.4, suffix: "B", prefix: "$", label: "Monthly transactions" },
  { value: 12000, suffix: "+", label: "Startups banking" },
];

const plans = [
  { name: "Starter", price: 0, desc: "For early-stage startups getting set up", features: ["Instant account opening", "2 team members", "Basic bookkeeping", "Standard corporate card", "Email support"] },
  { name: "Growth", price: 149, desc: "For startups scaling operations", features: ["Everything in Starter", "Unlimited team members", "AI bookkeeping & reconciliation", "Smart treasury management", "Advanced analytics dashboard", "Priority support"], popular: true },
  { name: "Scale", price: 399, desc: "For funded startups with complex needs", features: ["Everything in Growth", "Multi-entity support", "Custom integrations & API", "White-glove onboarding", "Dedicated success manager", "SLA guarantees"] },
];

export default function Page() {
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageRef = useRef(null);

  useEffect(() => {
    if (!gsap || !ScrollTrigger) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.refresh();

      // Hero entrance animation
      gsap.fromTo('.hero-content > *', 
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.3 }
      );

      gsap.fromTo('.hero-image', 
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power2.out', delay: 0.6 }
      );

      // Feature cards scroll reveal
      gsap.fromTo('.feature-card',
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out',
          scrollTrigger: { trigger: '.features-section', start: 'top 80%' } }
      );

      // Stats counter animation
      document.querySelectorAll('.stat-value').forEach(el => {
        const target = parseFloat((el as HTMLElement).dataset.target || '0');
        const isDecimal = target % 1 !== 0;
        gsap.fromTo(el,
          { textContent: 0 },
          { textContent: target, duration: 2, ease: 'power2.out',
            snap: { textContent: isDecimal ? 0.1 : 1 },
            scrollTrigger: { trigger: '.stats-section', start: 'top 80%' } }
        );
      });

      // Parallax on hero image
      gsap.to('.hero-parallax', {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: true }
      });

      // Section backgrounds parallax
      gsap.to('.bg-parallax', {
        yPercent: -20,
        ease: 'none',
        scrollTrigger: { trigger: '.bg-section', start: 'top bottom', end: 'bottom top', scrub: true }
      });

      // Testimonial fade
      gsap.fromTo('.testimonial-card',
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: '.testimonial-section', start: 'top 80%' } }
      );

      // Pricing cards
      gsap.fromTo('.pricing-card',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out',
          scrollTrigger: { trigger: '.pricing-section', start: 'top 80%' } }
      );

    }, pageRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen" style={{ fontFamily: "'Sora', sans-serif", background: '#0B0B10', color: '#E8E8EF' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
        
        .aurora-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        
        .aurora-gradient {
          position: absolute;
          width: 150%;
          height: 150%;
          top: -25%;
          left: -25%;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
          animation: aurora-drift 20s ease-in-out infinite;
        }
        
        @keyframes aurora-drift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(2%, 2%) rotate(1deg); }
          66% { transform: translate(-2%, 1%) rotate(-1deg); }
        }
        
        .aurora-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: float-orb 15s ease-in-out infinite;
        }
        
        .orb-1 {
          width: 400px;
          height: 400px;
          background: rgba(99, 102, 241, 0.2);
          top: -100px;
          right: -100px;
          animation-delay: 0s;
        }
        
        .orb-2 {
          width: 300px;
          height: 300px;
          background: rgba(16, 185, 129, 0.15);
          bottom: 20%;
          left: -50px;
          animation-delay: -5s;
        }
        
        .orb-3 {
          width: 250px;
          height: 250px;
          background: rgba(139, 92, 246, 0.12);
          top: 40%;
          right: 20%;
          animation-delay: -10s;
        }
        
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.05); }
          50% { transform: translate(-10px, 20px) scale(0.95); }
          75% { transform: translate(30px, 10px) scale(1.02); }
        }
        
        .grain-overlay {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.03;
          pointer-events: none;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #E8E8EF 0%, #818CF8 50%, #10B981 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .btn-primary {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #818CF8 0%, #6366F1 100%);
          transition: all 0.3s ease;
        }
        
        .btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .btn-primary:hover::before {
          opacity: 1;
        }
        
        .btn-primary span {
          position: relative;
          z-index: 1;
        }
        
        .btn-secondary {
          border: 1px solid rgba(232, 232, 239, 0.2);
          transition: all 0.3s ease;
        }
        
        .btn-secondary:hover {
          background: rgba(232, 232, 239, 0.05);
          border-color: rgba(232, 232, 239, 0.4);
        }
        
        .card-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .card-hover:hover {
          transform: translateY(-8px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .nav-blur {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        @media (prefers-reduced-motion: reduce) {
          .aurora-gradient, .aurora-orb, .grain-overlay {
            animation: none;
          }
          .hero-content > *, .hero-image, .feature-card, .testimonial-card, .pricing-card {
            opacity: 1;
            transform: none;
          }
          .stat-value {
            transition: none;
          }
        }
      `}</style>

      <div className="aurora-bg">
        <div className="aurora-gradient" />
        <div className="aurora-orb orb-1" />
        <div className="aurora-orb orb-2" />
        <div className="aurora-orb orb-3" />
        <div className="grain-overlay" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isNavScrolled ? 'nav-blur bg-[#0B0B10]/80 border-b border-white/5' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AuroraIcon />
            <span className="text-xl font-bold tracking-tight">Aurora</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
            <a href="#about" className="text-sm text-white/60 hover:text-white transition-colors">About</a>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="hidden sm:block text-sm text-white/60 hover:text-white transition-colors">Sign in</button>
            <button className="btn-primary px-5 py-2.5 rounded-full text-sm font-medium">
              <span>Get Started</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="hero-content">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-white/70">Now in public beta</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              Banking built<br />
              for how <span className="gradient-text">startups work</span>
            </h1>
            
            <p className="text-lg text-white/60 mb-10 max-w-lg leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Instant accounts, AI-powered bookkeeping, and smart treasury — all in one place. No more juggling five tools to run your startup's finances.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <button className="btn-primary px-8 py-4 rounded-full text-base font-semibold">
                <span>Open your account free</span>
              </button>
              <button className="btn-secondary px-8 py-4 rounded-full text-base font-medium flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Watch demo
              </button>
            </div>
          </div>
          
          <div className="hero-image relative hero-parallax">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1488415032361-b7e238421f1b?ixid=M3w5NjgxMjV8MHwxfHNlYXJjaHwxMnx8YXVyb3JhJTJDbmF0aXZlJTJDYnVzaW5lc3N8ZW58MHwwfHx8MTc4MDQ3MjYyM3ww&ixlib=rb-4.1.0&w=1920&h=1080&fit=crop&q=80"
                alt="Aurora banking dashboard"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            
            {/* Floating card */}
            <div className="absolute -bottom-8 -left-8 bg-[#1a1a24] rounded-2xl p-5 border border-white/10 shadow-xl card-hover">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/20 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white/60">Balance</p>
                  <p className="text-2xl font-bold">$847,291</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <p className="text-sm text-indigo-400 font-medium mb-4 tracking-wider uppercase">Everything you need</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              One platform, <span className="text-white/60">zero friction</span>
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto" style={{ fontFamily: "'Manrope', sans-serif" }}>
              We built the banking stack we'd always wanted as founders. Now it's yours.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="feature-card card-hover bg-white/5 border border-white/10 rounded-2xl p-8 group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Band */}
      <section className="stats-section relative py-24 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="stat-value text-4xl md:text-5xl lg:text-6xl font-bold mb-2" data-target={stat.value}>
                  {stat.prefix || ''}{stat.value}{stat.suffix}
                </p>
                <p className="text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section with Parallax BG */}
      <section className="bg-section relative py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1537136102161-ea2262437412?ixid=M3w5NjgxMjV8MHwxfHNlYXJjaHw5fHxhdXJvcmElMkNuYXRpdmUlMkNidXNpbmVzc3xlbnwwfDB8fHwxNzgwNDcyNjIzfDA&ixlib=rb-4.1.0&w=1920&h=1080&fit=crop&q=80"
            alt=""
            className="w-full h-full object-cover opacity-20 bg-parallax"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B10] via-[#0B0B10]/80 to-[#0B0B10]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm text-emerald-400 font-medium mb-4 tracking-wider uppercase">How it works</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Up and running<br />in <span className="gradient-text">minutes</span>
              </h2>
              <p className="text-lg text-white/60 mb-8 leading-relaxed" style={{ fontFamily: "'Manrope', sans-serif" }}>
                We stripped away the legacy infrastructure that makes traditional banks slow. What remains is banking that moves at the speed of your startup.
              </p>
              
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Create your account', desc: 'Sign up with just your email and EIN. No incorporation documents required.' },
                  { step: '02', title: 'Verify your business', desc: 'AI-powered identity verification takes under 60 seconds for most businesses.' },
                  { step: '03', title: 'Start transacting', desc: 'Get virtual cards instantly, physical cards in 3-5 days. Wire and ACH ready day one.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-2xl font-bold text-indigo-400">{item.step}</span>
                    <div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="card-hover rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1568607689150-17e625c1586e?ixid=M3w5NjgxMjV8MHwxfHNlYXJjaHwyfHxhdXJvcmElMkNuYXRpdmUlMkNidXNpbmVzc3xlbnwwfDB8fHwxNzgwNDcyNjIzfDA&ixlib=rb-4.1.0&w=1920&h=1080&fit=crop&q=80"
                alt="Aurora product interface"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="testimonial-section py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <svg className="w-12 h-12 mx-auto mb-8 text-indigo-400/50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            
            <blockquote className="text-2xl md:text-4xl font-light leading-relaxed mb-8">
              "We closed our seed round on a Tuesday. By Wednesday afternoon, we had our Aurora account open with $2M deployed in treasury. That's not something you can do with any other bank."
            </blockquote>
            
            <div className="flex items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-lg font-bold">
                SK
              </div>
              <div className="text-left">
                <p className="font-semibold">Sarah Kim</p>
                <p className="text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>CEO, Helix Bio</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Logos */}
      <section className="py-16 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-white/40 mb-10 tracking-wider uppercase">Trusted by 12,000+ startups</p>
          <div className="flex items-center justify-center gap-12 lg:gap-20 flex-wrap opacity-40">
            {['Sequoia', 'a16z', 'Benchmark', 'First Round', 'YC'].map((logo, i) => (
              <span key={i} className="text-lg font-semibold tracking-tight">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm text-indigo-400 font-medium mb-4 tracking-wider uppercase">Simple pricing</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Start free, <span className="text-white/60">scale as you grow</span>
            </h2>
            <p className="text-lg text-white/50 max-w-xl mx-auto" style={{ fontFamily: "'Manrope', sans-serif" }}>
              No hidden fees, no minimums, no surprises. Pay for what you need.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div key={i} className={`pricing-card relative rounded-3xl p-8 card-hover ${plan.popular ? 'bg-gradient-to-b from-indigo-500/10 to-transparent border-2 border-indigo-500/50' : 'bg-white/5 border border-white/10'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-500 text-xs font-semibold">
                    Most popular
                  </div>
                )}
                
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <p className="text-sm text-white/50 mb-6" style={{ fontFamily: "'Manrope', sans-serif" }}>{plan.desc}</p>
                
                <div className="mb-8">
                  <span className="text-5xl font-bold">${plan.price}</span>
                  <span className="text-white/50">/mo</span>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="text-emerald-400 mt-0.5"><CheckIcon /></span>
                      <span className="text-sm text-white/70" style={{ fontFamily: "'Manrope', sans-serif" }}>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button className={`w-full py-4 rounded-xl font-semibold transition-all ${plan.popular ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-white/10 hover:bg-white/15'}`}>
                  {plan.price === 0 ? 'Get started free' : 'Start free trial'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-emerald-600/20" />
        <div className="absolute inset-0 bg-[#0B0B10]/60" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Ready to bank<br />like a modern company?
          </h2>
          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Join 12,000+ startups who've ditched legacy banking for Aurora.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <button className="btn-primary px-10 py-5 rounded-full text-lg font-semibold">
              <span>Open your free account</span>
            </button>
          </div>
          
          <p className="mt-6 text-sm text-white/40" style={{ fontFamily: "'Manrope', sans-serif" }}>
            No credit card required · FDIC insured · 256-bit encryption
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <AuroraIcon />
                <span className="text-xl font-bold tracking-tight">Aurora</span>
              </div>
              <p className="text-white/50 max-w-xs" style={{ fontFamily: "'Manrope', sans-serif" }}>
                AI-native business banking for startups. Instant accounts, automated bookkeeping, smart treasury.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-white/50" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5">
            <p className="text-sm text-white/40" style={{ fontFamily: "'Manrope', sans-serif" }}>
              © 2025 Aurora Financial, Inc. All rights reserved.
            </p>
            
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713a4.05 4.05 0 001.02 3.138 4.047 4.047 0 01-1.853-.07 4.107 4.107 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}