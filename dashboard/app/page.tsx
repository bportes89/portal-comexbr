'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Languages,
  LayoutDashboard,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

type LandingCopy = {
  nav: { solution: string; features: string; process: string; faq: string; login: string };
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  stats: Array<{ value: string; label: string }>;
  proofTitle: string;
  proofItems: string[];
  featureSection: { eyebrow: string; title: string; subtitle: string };
  featureCards: Array<{ title: string; description: string }>;
  processSection: { eyebrow: string; title: string; steps: Array<{ title: string; description: string }> };
  audienceSection: { eyebrow: string; title: string; items: string[] };
  faqSection: { eyebrow: string; title: string; items: Array<{ question: string; answer: string }> };
  ctaSection: { title: string; description: string; button: string };
  loginCard: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    remember: string;
    forgot: string;
    button: string;
    helper: string;
    credentials: string;
    invalid: string;
    fallback: string;
  };
  dashboardPreview: {
    title: string;
    subtitle: string;
    metrics: Array<{ label: string; value: string; hint: string }>;
    pills: string[];
  };
  footer: string;
};

const copyByLanguage: Record<'pt' | 'en', LandingCopy> = {
  pt: {
    nav: {
      solution: 'Solução',
      features: 'Recursos',
      process: 'Como funciona',
      faq: 'FAQ',
      login: 'Entrar',
    },
    badge: 'WhatsApp automation para vendas, follow-up e atendimento com escala',
    heroTitle: 'Transforme o WhatsApp em um canal previsível de aquisição, conversão e relacionamento.',
    heroSubtitle: 'Landing page comercial para vender uma operação completa, não apenas disparos.',
    heroDescription:
      'O Portal ComexBr centraliza campanhas, contatos, automações, filas inteligentes e gestão de múltiplos números em uma experiência SaaS premium. Ideal para equipes comerciais, operações BPO e consultorias que precisam escalar conversas sem perder controle.',
    primaryCta: 'Quero Ver a Plataforma',
    secondaryCta: 'Explorar Recursos',
    stats: [
      { value: '1 painel', label: 'para campanhas, contatos, analytics e automações' },
      { value: '24/7', label: 'de operação com respostas automáticas e follow-up' },
      { value: 'Multiusuário', label: 'com projetos, permissões e visão por operação' },
    ],
    proofTitle: 'Construído para operações que querem vender com velocidade, organização e rastreabilidade.',
    proofItems: [
      'Campanhas com delay inteligente para reduzir risco operacional',
      'Conexão por QR Code com sessões persistidas e controle por projeto',
      'Automações por palavra-chave para atendimento e qualificação imediata',
      'Estrutura pronta para white label, BPO e operação comercial recorrente',
    ],
    featureSection: {
      eyebrow: 'Recursos principais',
      title: 'Tudo o que um produto comercializável precisa para gerar percepção de valor.',
      subtitle:
        'A landing foi pensada para comunicar clareza, autoridade e ganho financeiro desde o primeiro scroll.',
    },
    featureCards: [
      {
        title: 'Disparo com cadência segura',
        description:
          'Campanhas com filas, delays e distribuição gradual para preservar o número e manter estabilidade operacional.',
      },
      {
        title: 'Automações de atendimento',
        description:
          'Regras por palavra-chave, respostas instantâneas e continuidade de conversa para qualificação de leads.',
      },
      {
        title: 'Dashboard executivo',
        description:
          'Visão de campanhas, contatos, grupos, scoring, projetos e estatísticas em uma interface premium.',
      },
      {
        title: 'Operação white label',
        description:
          'Estruture a solução com sua marca, crie hierarquia de acessos e entregue a plataforma como ativo comercial.',
      },
      {
        title: 'Escalável para BPO',
        description:
          'Modelo pronto para vender não só software, mas uma operação assistida de geração e atendimento.',
      },
      {
        title: 'Base pronta para IA',
        description:
          'Camada ideal para evoluir com atendimento inteligente, automações contextuais e score de oportunidades.',
      },
    ],
    processSection: {
      eyebrow: 'Como funciona',
      title: 'Da conexão do número ao fechamento de oportunidades em poucos passos.',
      steps: [
        {
          title: 'Conecte o WhatsApp',
          description: 'O usuário faz a leitura do QR Code e o sistema mantém a sessão pronta para operação.',
        },
        {
          title: 'Organize listas e projetos',
          description: 'Contatos, tags, grupos e campanhas ficam centralizados em uma estrutura simples de operar.',
        },
        {
          title: 'Dispare com inteligência',
          description: 'Mensagens são enviadas em cadência controlada para reduzir risco de bloqueio e aumentar resposta.',
        },
        {
          title: 'Automatize a resposta',
          description: 'Quando o lead responde, a operação continua com regras, atendimento e acompanhamento.',
        },
      ],
    },
    audienceSection: {
      eyebrow: 'Ideal para',
      title: 'Perfeito para quem quer transformar WhatsApp em produto, canal de vendas ou operação recorrente.',
      items: [
        'Consultorias e assessorias que querem vender serviço + tecnologia',
        'Operações comerciais com SDR, closer e follow-up estruturado',
        'Agências, infoprodutores e lançamentos com alto volume de leads',
        'Empresas que precisam centralizar atendimento e campanhas em um só lugar',
      ],
    },
    faqSection: {
      eyebrow: 'Perguntas frequentes',
      title: 'Objeções comerciais respondidas de forma clara e persuasiva.',
      items: [
        {
          question: 'É difícil começar a usar?',
          answer:
            'Não. A operação foi desenhada para ser simples: conectar o número, subir contatos, criar a campanha e acompanhar os resultados pelo painel.',
        },
        {
          question: 'Posso vender como plataforma ou como serviço?',
          answer:
            'Sim. A estrutura atende tanto ao modelo SaaS quanto ao modelo BPO, com espaço para white label e operação assistida.',
        },
        {
          question: 'Ela serve só para disparo?',
          answer:
            'Não. O diferencial é combinar disparo, atendimento, automação, organização comercial e analytics em uma única experiência.',
        },
        {
          question: 'Consigo crescer a operação com segurança?',
          answer:
            'Sim. O produto foi desenhado com fila, controle de sessões, delays e arquitetura preparada para evolução operacional.',
        },
      ],
    },
    ctaSection: {
      title: 'Se o objetivo é comercializar, a primeira impressão precisa vender por você.',
      description:
        'Use esta landing para posicionar o produto como solução premium, aumentar confiança e acelerar conversões desde o topo do funil.',
      button: 'Acessar Demonstração',
    },
    loginCard: {
      title: 'Acesso demonstrativo',
      subtitle: 'Entre no painel e apresente o produto em uma experiência real.',
      email: 'E-mail',
      password: 'Senha',
      remember: 'Lembrar de mim',
      forgot: 'Recuperar acesso',
      button: 'Entrar na demonstração',
      helper: 'Credenciais de demonstração',
      credentials: 'admin@portalcomexbr.com / admin123',
      invalid: 'E-mail ou senha inválidos.',
      fallback: 'Ocorreu um erro ao entrar. Tente novamente.',
    },
    dashboardPreview: {
      title: 'Experiência SaaS premium',
      subtitle: 'Design escuro, sensação enterprise e foco total em percepção de valor.',
      metrics: [
        { label: 'Mensagens enviadas', value: '+18.240', hint: 'com cadência controlada' },
        { label: 'Números conectados', value: '12', hint: 'operações simultâneas' },
        { label: 'Taxa de resposta', value: '34%', hint: 'follow-up + automação' },
      ],
      pills: ['Campanhas', 'Automações', 'Analytics', 'Projetos'],
    },
    footer: 'Portal ComexBr. Plataforma de automação comercial, campanhas e operação WhatsApp.',
  },
  en: {
    nav: {
      solution: 'Solution',
      features: 'Features',
      process: 'How it works',
      faq: 'FAQ',
      login: 'Login',
    },
    badge: 'WhatsApp automation for sales, follow-up, and customer engagement at scale',
    heroTitle: 'Turn WhatsApp into a predictable channel for acquisition, conversion, and retention.',
    heroSubtitle: 'A commercial landing page built to sell a full operation, not just message blasts.',
    heroDescription:
      'Portal ComexBr centralizes campaigns, contacts, automations, smart queues, and multi-number operations in a premium SaaS experience. Perfect for sales teams, BPO structures, and consulting firms that need scale without losing control.',
    primaryCta: 'See the Platform',
    secondaryCta: 'Explore Features',
    stats: [
      { value: '1 hub', label: 'for campaigns, contacts, analytics, and automation' },
      { value: '24/7', label: 'operation with automated replies and structured follow-up' },
      { value: 'Multi-user', label: 'with projects, permissions, and operation-level views' },
    ],
    proofTitle: 'Built for operations that want speed, organization, and measurable sales activity.',
    proofItems: [
      'Queue-based campaigns with smart delays to reduce operational risk',
      'QR Code connection flow with session persistence and project assignment',
      'Keyword automations for faster support and instant qualification',
      'Ready for white-label, BPO, and recurring commercial operations',
    ],
    featureSection: {
      eyebrow: 'Core features',
      title: 'Everything a monetizable product needs to communicate premium value.',
      subtitle:
        'This landing page is designed to create clarity, authority, and revenue perception from the first scroll.',
    },
    featureCards: [
      {
        title: 'Safe sending cadence',
        description:
          'Campaigns use queues, delays, and progressive delivery to protect numbers and sustain healthy operations.',
      },
      {
        title: 'Automated conversations',
        description:
          'Keyword rules, instant answers, and conversation continuity help qualify leads in real time.',
      },
      {
        title: 'Executive dashboard',
        description:
          'Track campaigns, contacts, groups, scoring, projects, and performance in a premium interface.',
      },
      {
        title: 'White-label operation',
        description:
          'Bring your brand, define access hierarchy, and package the platform as a commercial asset.',
      },
      {
        title: 'BPO-ready model',
        description:
          'Sell not only software, but an assisted operation for outreach, follow-up, and response handling.',
      },
      {
        title: 'AI-ready foundation',
        description:
          'An ideal layer to evolve into intelligent support, contextual automation, and lead scoring.',
      },
    ],
    processSection: {
      eyebrow: 'How it works',
      title: 'From WhatsApp connection to opportunity conversion in a few clear steps.',
      steps: [
        {
          title: 'Connect the number',
          description: 'The user scans the QR Code and the system keeps the session ready for operation.',
        },
        {
          title: 'Organize lists and projects',
          description: 'Contacts, tags, groups, and campaigns stay centralized in an easy-to-run structure.',
        },
        {
          title: 'Send with control',
          description: 'Messages go out with smart cadence to reduce risk and increase response quality.',
        },
        {
          title: 'Automate the response',
          description: 'Once a lead replies, the flow continues through rules, service, and follow-up.',
        },
      ],
    },
    audienceSection: {
      eyebrow: 'Best fit',
      title: 'Ideal for teams that want to turn WhatsApp into a product, a sales channel, or a recurring operation.',
      items: [
        'Consulting firms that want to sell service plus technology',
        'Sales operations with SDR, closer, and structured follow-up',
        'Agencies, launches, and info-products working with high lead volume',
        'Businesses that need campaigns and support in one place',
      ],
    },
    faqSection: {
      eyebrow: 'Frequently asked questions',
      title: 'Commercial objections answered in a clear and persuasive way.',
      items: [
        {
          question: 'Is it hard to start using it?',
          answer:
            'No. The flow is simple: connect the number, upload contacts, launch a campaign, and track performance from the dashboard.',
        },
        {
          question: 'Can I sell it as software or as a managed service?',
          answer:
            'Yes. The structure supports both SaaS and BPO models, with room for white-label packaging and assisted operations.',
        },
        {
          question: 'Is it only for bulk sending?',
          answer:
            'No. The core value is combining outreach, support, automation, commercial organization, and analytics in one experience.',
        },
        {
          question: 'Can the operation scale safely?',
          answer:
            'Yes. The product is designed with queues, session control, delays, and architecture that supports operational growth.',
        },
      ],
    },
    ctaSection: {
      title: 'If you want to commercialize this product, the first impression must sell for you.',
      description:
        'Use this landing page to position the product as a premium solution, build trust, and improve conversion at the top of the funnel.',
      button: 'Access Demo',
    },
    loginCard: {
      title: 'Demo access',
      subtitle: 'Enter the dashboard and present the product through a real experience.',
      email: 'Email',
      password: 'Password',
      remember: 'Remember me',
      forgot: 'Recover access',
      button: 'Enter demo',
      helper: 'Demo credentials',
      credentials: 'admin@portalcomexbr.com / admin123',
      invalid: 'Invalid email or password.',
      fallback: 'An error occurred while signing in. Please try again.',
    },
    dashboardPreview: {
      title: 'Premium SaaS feel',
      subtitle: 'Dark UI, enterprise perception, and a visual language built to increase value perception.',
      metrics: [
        { label: 'Messages sent', value: '+18,240', hint: 'with controlled cadence' },
        { label: 'Connected numbers', value: '12', hint: 'parallel operations' },
        { label: 'Reply rate', value: '34%', hint: 'automation + follow-up' },
      ],
      pills: ['Campaigns', 'Automation', 'Analytics', 'Projects'],
    },
    footer: 'Portal ComexBr. Commercial automation, campaigns, and WhatsApp operations platform.',
  },
};

const featureIcons = [Zap, Bot, LayoutDashboard, ShieldCheck, Workflow, Sparkles];
const processIcons = [QrCode, Users, MessageSquareText, CheckCircle2];

export default function Home() {
  const { language, setLanguage } = useLanguage();
  const { login } = useAuth();
  const router = useRouter();
  const copy = copyByLanguage[language];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (
        email === 'admin@portalcomexbr.com' &&
        (password === 'password123' || password === 'admin123')
      ) {
        await login(email);
        router.push('/dashboard');
      } else {
        setError(copy.loginCard.invalid);
      }
    } catch {
      setError(copy.loginCard.fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = useMemo(
    () => [
      { href: '#solucao', label: copy.nav.solution },
      { href: '#recursos', label: copy.nav.features },
      { href: '#processo', label: copy.nav.process },
      { href: '#faq', label: copy.nav.faq },
    ],
    [copy],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-green-500/30 selection:text-green-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_25%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.10),_transparent_30%)]" />
        <div className="absolute inset-0 bg-noise opacity-[0.04]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.3),rgba(2,6,23,0.92))]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl ring-1 ring-white/10">
              <Image src="/logo.jpeg" alt="Portal ComexBr" fill sizes="40px" className="object-cover" priority />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.24em] text-green-400">PORTAL COMEXBR</div>
              <div className="text-xs text-slate-400">WhatsApp growth operating system</div>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              <Languages className="h-4 w-4" />
              <span className="uppercase">{language}</span>
            </button>
            <a
              href="#acesso"
              className="hidden rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/20 lg:inline-flex"
            >
              {copy.nav.login}
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm text-green-200">
                <Sparkles className="h-4 w-4" />
                {copy.badge}
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                {copy.heroTitle}
              </h1>

              <p className="mt-4 max-w-2xl text-lg text-green-200/90">{copy.heroSubtitle}</p>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">{copy.heroDescription}</p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#acesso"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition hover:-translate-y-0.5 hover:shadow-green-700/30"
                >
                  {copy.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#recursos"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                >
                  {copy.secondaryCta}
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {copy.stats.map((stat) => (
                  <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                    <div className="text-2xl font-semibold text-white">{stat.value}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-8 top-8 h-80 rounded-full bg-green-500/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-green-300">Portal ComexBr</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{copy.dashboardPreview.title}</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                      {copy.dashboardPreview.subtitle}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-[0.18em] text-green-300">Live</div>
                    <div className="mt-1 text-lg font-semibold text-white">SaaS Sales OS</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {copy.dashboardPreview.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/8 bg-slate-950/60 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                      <div className="mt-2 text-sm text-slate-400">{metric.hint}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {copy.dashboardPreview.pills.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300"
                    >
                      {pill}
                    </span>
                  ))}
                </div>

                <div className="mt-8 rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.85))] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Why it sells</div>
                      <div className="mt-3 text-xl font-semibold text-white">{copy.proofTitle}</div>
                    </div>
                    <div className="rounded-2xl bg-green-500/10 p-3 text-green-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {copy.proofItems.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-400" />
                        <p className="text-sm leading-6 text-slate-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="solucao" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">
              {copy.featureSection.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
              {copy.featureSection.title}
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">{copy.featureSection.subtitle}</p>
          </div>

          <div id="recursos" className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {copy.featureCards.map((feature, index) => {
              const Icon = featureIcons[index];
              return (
                <div
                  key={feature.title}
                  className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-green-400/20 hover:bg-white/[0.06]"
                >
                  <div className="inline-flex rounded-2xl border border-green-400/20 bg-green-500/10 p-3 text-green-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="processo" className="border-y border-white/10 bg-white/[0.03] py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">
                  {copy.processSection.eyebrow}
                </p>
                <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                  {copy.processSection.title}
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {copy.processSection.steps.map((step, index) => {
                  const Icon = processIcons[index];
                  return (
                    <div key={step.title} className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-green-300">0{index + 1}</div>
                        <div className="rounded-2xl bg-white/5 p-3 text-slate-200">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{step.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">
                {copy.audienceSection.eyebrow}
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                {copy.audienceSection.title}
              </h2>
            </div>
            <div className="grid gap-4">
              {copy.audienceSection.items.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="rounded-2xl bg-green-500/10 p-3 text-green-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <p className="text-base leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">
              {copy.faqSection.eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{copy.faqSection.title}</h2>
          </div>
          <div className="mt-12 grid gap-4">
            {copy.faqSection.items.map((item) => (
              <div key={item.question} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="acesso" className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:px-8">
          <div className="grid gap-8 overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-8 shadow-2xl shadow-black/30 lg:grid-cols-[1fr_420px] lg:p-10">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">CTA</p>
                <h2 className="mt-4 max-w-3xl text-3xl font-semibold text-white sm:text-4xl">
                  {copy.ctaSection.title}
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{copy.ctaSection.description}</p>
              </div>

              <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-sm text-green-100">
                <Clock3 className="h-5 w-5 text-green-300" />
                <span>{copy.ctaSection.button}</span>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-6 backdrop-blur-2xl">
              <div>
                <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-3">
                  <LayoutDashboard className="h-5 w-5 text-slate-100" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{copy.loginCard.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{copy.loginCard.subtitle}</p>
                <div className="mt-4 rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-green-200">{copy.loginCard.helper}</div>
                  <div className="mt-1 text-sm font-medium text-white">{copy.loginCard.credentials}</div>
                </div>
              </div>

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                    {copy.loginCard.email}
                  </label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@portalcomexbr.com"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-green-400/40 focus:bg-white/8"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                    {copy.loginCard.password}
                  </label>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-green-400/40 focus:bg-white/8"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-slate-400">
                    <input type="checkbox" className="h-4 w-4 rounded border-white/10 bg-white/5" />
                    {copy.loginCard.remember}
                  </label>
                  <a href="#acesso" className="font-medium text-green-300 transition hover:text-green-200">
                    {copy.loginCard.forgot}
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {copy.loginCard.button}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.footer}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <MessageSquareText className="h-4 w-4" />
            <span>WhatsApp-first revenue engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
