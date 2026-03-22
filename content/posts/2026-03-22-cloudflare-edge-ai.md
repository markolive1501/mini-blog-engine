---
title: "Cloudflare Wants to Put a Big AI Model in Your Browser's Neighbourhood"
date: 2026-03-22
tags: [ai, edge-computing, inference, cloudflare]
description: Cloudflare just started running large AI models at the edge — and that changes more than you think.
---

There's a quiet war happening in AI infrastructure, and most people aren't paying attention. It's not about who has the biggest model. It's about *where the model runs* — and Cloudflare just fired a significant shot.

Workers AI, Cloudflare's edge inference platform, announced this week that it's now running large models at its edge nodes worldwide, starting with Kimi K2.5. For the uninitiated: this means instead of sending your prompt to a data centre somewhere in Virginia or Frankfurt, the computation happens much closer to you — often in the same city.

**Why does that matter?**

Three reasons, and none of them are trivial.

First, *latency*. A round-trip to a centralised GPU cluster can chew through 500–800ms before the model even starts thinking. Edge inference can bring that down to under 100ms. For interactive applications — coding assistants, real-time translation, voice agents — that's the difference between usable and frustrating.

Second, *data sovereignty*. Running models at the edge means your prompts don't have to travel across the internet to a third-party data centre. For enterprises in regulated industries, or anyone who just doesn't love the idea of their internal documents bouncing through someone else's servers, this is a genuine selling point.

Third — and this is the underappreciated one — *cost architecture*. Cloudflare's model isn't about undercutting OpenAI on price per token. It's about making inference cheap enough to embed in high-volume, latency-sensitive applications where you're charging fractions of a cent per call. Think customer support, not ChatGPT competitor.

**The Kimi K2.5 angle is worth noting too.** Kimi is a Chinese AI lab (Moonshot AI) that has been making serious noise in reasoning and long-context tasks. Cloudflare choosing it as the flagship large model for Workers AI signals that they're not just picking Western models — they're building a model-agnostic edge layer. That's a strategic move.

**So what's the catch?**

The honest answer: large model edge inference is still early. Getting a 70B+ parameter model to run efficiently on hardware distributed across hundreds of cities, with consistent quality and uptime, is a hard engineering problem. Cloudflare has the network and the customer base to make it work — but this isn't a solved problem yet.

That said, the trajectory is clear. The hyperscalers (AWS, Azure, Google Cloud) currently dominate AI inference because they have the GPUs. Cloudflare is betting that for a meaningful slice of applications — the ones where latency and privacy matter more than raw benchmark performance — edge inference wins.

It might take a few years. But the browser's neighbourhood is about to get a lot smarter.

---

*Got a view on edge AI inference? Or a correction? As always, I'm around.*
