---
title: "Bayes' theorem: Making sense of COVID tests"
description: "Understanding the 18th-century maths theorem that governs the reliability of (corona) virus testing."
summary: "Understanding the 18th-century maths theorem that governs the reliability of (corona) virus testing."
date: 2021-05-21
draft: false

---

{{< lead >}}
Understanding the 18th-century maths theorem that governs the reliability of (corona)virus testing.
{{< /lead >}}

Picture this. You take a test for a rare disease and the result comes back positive. The test is also very accurate, giving the correct result 99% of the time. What is the chance you do actually have the disease? 99%, surely?...

Based on this information alone, you actually have no idea: there simply isn’t enough information to make a judgement.

As governments and institutions around the world ramp up their use of lateral flow tests (LFTs) for asymptomatic COVID-19 testing, such events are playing out more and more frequently, and this seemingly benign question is becoming increasingly important.

The rationale behind asymptomatic testing is simple: by taking a test just before entering certain shared spaces such as schools, theatres, or nightclubs, you can increase the level of confidence that you, or someone else, does not have the disease and therefore won’t be spreading it.

However, there has been some concern over the accuracy of LFTs and the consequences of their results. One concern is that they could miss a significant number of positive cases because they are less sensitive than the slower, lab-based PCR test.

Another concern is quite the opposite – that the result could be positive when the person is actually disease-free – producing a so-called “false positive”. This might not sound like a terrible problem to have, but the impacts of false positives are significant: unnecessary stress; avoidable follow-up procedures; inability to work; and financial losses to name a few. It would really help to know how likely false positives are.

This brings us back to the original question: given a positive result from an LFT, what is the probability that the test is accurate, and you do in fact have the disease. The answer depends on one key piece of additional information and can be calculated using a simple but profound mathematical formula known as Bayes’ theorem.

Named after its inventor, the 18th-century mathematician and minister Thomas Bayes, Bayes’ theorem is a method of determining the probability of an event based on the best available evidence, also known as conditional probability. It provides a way to update an existing belief, such as a prediction or theory, given new or additional information.

The formula for Bayes’ theorem is given below, but the mathematical notation might need some explaining. \\(P\\) stands for probability, so \\(P(A)\\) represents the probability of event \\(A\\) occurring, and \\(P(B)\\) is the probability of event \\(B\\). \\(P(A | B)\\) means the conditional probability that event \\(A\\) occurs given that event \\(B\\) happened.

{{< katex display=true >}}
P(A | B) = \frac{P(B | A) \times P(A)}{P(B)}
{{< /katex >}}

Knowing this formula, let’s reframe our initial question in terms of events and known probabilities. We want to know the probability that someone has the disease, given a positive test result, which we can denote as \\(P(A | B)\\), where \\(P(A)\\) and \\(P(B)\\) are the probabilities of having the disease and getting a positive result, respectively.

We can assume the probability of having the disease, P(A), to be equal to the background rate of the disease in the population, for now let’s say 1 in 1000, or 0.001.  Here, P(A) is also called the “prior probability”. This assumption is valid given that asymptomatic testing is used to screen large numbers of people who are healthy and showing no signs of the disease.

The UK government states that the false-positive rate for LFTs is less than 1 in 1000, and therefore the test correctly identifies 99% of people who are COVID-free. We’ll assume the test is equally as good at detecting positive cases, meaning that P(B | A) – the probability of testing positive if you have the disease – would be 0.99.

The final probability to work out is P(B), which is the probability of getting a positive result. To calculate this, we have to consider two events as there are two scenarios which can lead to a positive result: when you have the disease (i.e. a true positive) and, conversely, when you don’t (i.e. a false positive).

The probability of a true positive is 0.99 x 0.001 = 0.00099, and for a false positive it is 0.01 x 0.999 = 0.0099. Summing these, we get the total probability of a positive result: 0.011.

When you plug all these values into the equation, Bayes' theorem yields the surprising, but nevertheless correct answer of 9%. There is a less than 1/10 chance you have the disease after testing positive, given all the conditions previously described.

To break this down, let’s look at some more relatable numbers. Take a population of 100,000 people, chosen at random and then tested for the disease. Using the case numbers reported in May 2021, there would be approximately 100 cases of COVID, and for simplicity let’s say that 99 of these are correctly identified. For the 99,900 remaining people who are disease-free, the test will correctly identify 98,901, but this leaves 999 people who will receive a false positive – roughly ten times the number of actual cases.

The reason the numbers don’t seem to add up is because of the rarity of the disease. If we use the data from January this year (2021) when COVID was at the height of its second peak, an estimated 1/55 had the disease and a positive LFT would have been accurate 66% of the time. Fast-forward a few months to May, when only 1/1000 were COVID-positive, and as we’ve seen, the outcome is very different.

Bayes’ theorem shows us why we need to factor this information into our predictions, something which might almost seem more common sense than complex statistics. It is an extremely simple yet powerful proposition which has found its way into many areas of modern thinking, from physics to philosophy.

Unfortunately, it’s also something that’s woefully misunderstood. In one study in 2013, researchers asked 5000 qualified doctors to give the probability that a patient had cancer, given that they received a positive result on a 90% accurate test, and the disease was found in 1% of the population. Even when presented with a multiple-choice answer, only a quarter of the participants identified the correct answer of “around 1/10”.

It doesn’t just affect the medical profession either. In a number of high-profile court cases, prosecutors have grossly miscalculated the probabilities of two events occurring, such as an innocent person’s DNA matching that found at the crime scene, leading to a host of wrongful convictions.

The “prosecutors’ fallacy” lies in assuming the probability of A given B is equal to B given A, ignoring Bayes’ rule. In one tragic case, solicitor Sally Clark was convicted for murdering her two sons after an expert witness falsely claimed that the chances of both her children dying of sudden infant death syndrome (SIDS) was 1 in 73 million. This statistic failed to take into account the prior probability that someone is a double murderer, and a number of other considerations such as genetic or environmental factors linked to SIDS. Thankfully, re-examination of flawed statistical evidence led to the conviction being overturned three years later.

Going back now to COVID testing, what do these results say about the reliability of LFTs? First, it's essential to consider your prior probability: as the disease becomes rarer, a positive result carries a greater chance of being false. This doesn’t mean that rapid testing becomes ineffective as case numbers fall – after all, they’re still detecting cases that would be otherwise missed – just that we should be more aware of false positives and how to handle them.

Extrapolating Bayes’ theorem also proves why taking a second test is so important if you get a positive result the first time round. In the earlier hypothetical scenario, given that the probability of you having disease was updated to 9% after the first positive result, the chance that you are COVID-positive after receiving a second positive test result is over 90%.

Ultimately, it's useful to remember that the numbers are not always as they seem. Rapid lateral flow testing remains a powerful tool to control contagious disease, but as Bayes has shown, to obtain the strongest conclusions you have to consider all the evidence.

---
