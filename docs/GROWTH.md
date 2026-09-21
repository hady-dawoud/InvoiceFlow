# InvoiceFlow — Growth & Revenue Plan

**Goal: $1000/month MRR.** The product is the vehicle; this document is the plan to
fill it with paying customers. Reviewed/updated monthly.

## 1. Unit economics

| Metric | Value | Notes |
|---|---|---|
| Price (Pro) | $9/mo | Psychological < $10; annual $90 (2 mo free) at v1.1 |
| Free plan | 3 invoices/calendar month | Enough to onboard, small enough to wall |
| Gross margin | ~98% | No AI/API per-user costs; hosting ≈ $0–20/mo (Vercel/Turso free tiers early) |
| Customers needed | ~111 × $9 | For $1000 MRR |
| Churn assumption | 4%/mo (freelancer SMB norm) | ~46 new customers/yr just to hold flat — retention features matter (recurring clients, reminders) |

**Reachability check:** 111 customers ≈ 2–3% conversion of a 4–5k signup base. That
is a realistic first-year indie SaaS trajectory if the top of funnel gets consistent
attention (see §3).

## 2. Why freelancers buy

Pain: invoicing is *unpaid admin*. Existing tools (FreshBooks $19/mo, Bonsai $25/mo,
Wave now paywalls features) are overkill/overpriced for a freelancer sending 3–10
invoices/month. InvoiceFlow's pitch: **"Professional invoices in 60 seconds —
nothing else in your way."**

Wedge: ultra-fast invoice creation (the 60-second promise) + free tier that actually
works, upgrade trigger hits the moment volume grows.

## 3. Channels (in order of expected ROI)

1. **SEO — bottom-funnel templates** (slowest, most durable). Programmatic pages:
   `invoice template for {graphic designers | photographers | consultants | tutors |
   …}` (30+ niches), "free invoice generator", "invoice vs receipt". Each niche page
   embeds a *live free-tier generator* → signup. Owner task: 1 page/week.
2. **Reddit r/freelance, r/graphic_design, r/webdev** — genuine participation,
   share the free tool (no paywall link-drops; lead with free, let volume upgrade).
   2–3 helpful comments/week + a "what do you use to invoice" thread monthly.
3. **Product Hunt launch** — after 30 beta users and polished onboarding. Target:
   200–500 signups on launch day.
4. **Indie Hackers / X build-in-public** — post weekly metrics screenshots;
   freelancers are IN that audience.
5. **Marketplace templates** — Notion/Etsy crowd: "invoice template" buyers are
   pre-qualified; give the template away, template links to the generator.
6. **Partnerships** — freelance job boards, coworking Slack groups, accounting
   newsletters (free 6-mo Pro codes for their members).

## 4. 90-day roadmap (owner = you, the founder)

**Days 1–14 — Beta (product done, 0 customers):**
- [ ] Deploy to Vercel + Turso, switch Stripe to live keys, buy domain
- [ ] Recruit 10 beta freelancers from personal network + 2 subreddits
- [ ] Instrument: signups, invoices created, upgrade-wall hits, Pro conversions

**Days 15–45 — First revenue:**
- [ ] Publish first 8 SEO template pages (start with best-paying niches)
- [ ] Ship onboarding polish: sample invoice pre-created, template gallery
- [ ] First 5 paying customers (goal: proof, not volume)
- [ ] Weekly build-in-public posts

**Days 46–90 — Repeatable funnel:**
- [ ] Product Hunt launch
- [ ] 30 SEO pages live; submit sitemap; target 1k organic visits/mo
- [ ] Annual plan + reminder emails (v1.1)
- [ ] Milestone: 25 customers ≈ $225 MRR, growth rate ≥ 15%/mo

**Months 4–12:** compounding SEO + PH/SEO tail. Realistic: $1000 MRR around
month 8–12 if conversion ≥2% and traffic compounds; the plan's biggest lever after
launch is *retention* (see §5).

## 5. Retention (the real MRR engine)

- Day-7 email: "your invoices this month" digest (v1.1)
- Payment reminders & overdue nudges (v1.2) — makes the tool *keep* earning its $9
- Recurring invoices for retainers (v1.3)
- Churn interview at cancel; win-back offer at 30 days

## 6. Metrics dashboard (track weekly)

`signups → activated (1st invoice) → hit wall → Pro conversion → MRR → churn`

North-star: **activated freelancers** (created ≥1 invoice). Everything upstream of
that is noise.
