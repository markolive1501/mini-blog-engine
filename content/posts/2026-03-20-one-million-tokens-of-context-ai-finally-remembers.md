---
title: "One Million Tokens of Context: AI Finally Remembers"
date: 2026-03-20
tags: [ai, llm, knowledge]
description: "Context windows of one million tokens mean AI can now read your entire codebase, legal contract, or book library in a single conversation. The implications are profound."
sourceUrl: "https://arxiv.org/abs/2407.21787"
---

Let me give you a concrete sense of what one million tokens actually means. This post you are reading right now is roughly 600 words, which is about 800 tokens. One million tokens is over a thousand such posts. It is the complete works of Shakespeare, twice over. It is the entire JavaScript codebase of a medium-sized startup. It is, in other words, a genuinely enormous amount of information that you can now feed directly into a single AI conversation.

That is not a marginal improvement. It is a phase change.

Until recently, context windows were the forgotten bottleneck in AI capability. Everyone talked about model intelligence, benchmark scores, and multimodal features. But if you tried to hand a model a long document or a large codebase, it would politely forget the beginning by the time it reached the middle. The famous needle-in-a-haystack problem, where models lose track of information at the start of a long context, was a well-known failure mode that practitioners had developed elaborate workarounds around. Retrieval-augmented generation, chunking strategies, and careful document structuring were all band-aids on a wound that is now being healed at the root.

Anthropic's Claude, Google's Gemini, and other frontier models now support context windows that effectively eliminate this problem for most real-world use cases. You can drop an entire legal contract into a conversation and ask questions that require reasoning across the entire document. You can hand a coding assistant a million-line codebase and ask it to trace how a particular piece of data flows through the system. You can give a model a hundred research papers and ask it to synthesize their findings. These were not possible or were only possible with elaborate external tooling. Now they work natively.

What this unlocks for software development in particular is remarkable. The gap between understanding a codebase in a short conversation versus being able to read and reason about the whole thing is the difference between asking someone who has heard of your project and asking someone who has memorized it. Code understanding, code review, debugging across large codebases, and architectural analysis all become fundamentally more capable when the model can actually see everything rather than just the part you pasted in.

There are still limits. Processing a million tokens costs more compute and therefore more money, though costs are dropping rapidly. Some models show degradation in quality at the very far ends of their context windows, though this is improving. And there is the more fundamental question of whether longer context makes models more reliable or just gives them more rope to hang themselves with. Longer contexts can amplify certain kinds of hallucination rather than eliminating it.

Even with those caveats, this is one of the most practically significant capability expansions in recent AI development. The information age just got a very fast reader.

https://arxiv.org/abs/2407.21787
