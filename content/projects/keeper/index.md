---
title: "Keeper"
description: "A small macOS app for organising and culling photos."
summary: "How to install Keeper on your Mac."
date: 2026-09-24
draft: false
---

The one of best (and worst) features of digital cameras is that you end up with lots of photos.

To avoid death by cloud subscriptions, it helps to be able to quickly cull the blurry pics, tag the favourites, and decide on the subtley best variation of the same six shots - this is what [Keeper](https://github.com/matthewtwarren/keeper) is for.

It's a small macOS app that lets you quickly review a folder of photos and tag them with colours, or flag them for deletion. You select a folder with your photos and flick through them one at a time. Press a number key to tag a photo with a colour, which shows up as a Finder tag; press `D` to flag one for the bin. When you're done, Keeper shows you a summary and tidies the folder up.

It never deletes anything. Flagged photos are just moved into a `delete/` folder inside the one you opened, so you can check them before emptying it yourself.

To install it, follow the instructions below. For usage, see the [README](https://github.com/matthewtwarren/keeper).

<br>

---

<br>

## What you'll need to install

A Mac running macOS 14 (Sonoma) or newer.

## 1. Open Terminal

Press `⌘ Space`, type `Terminal` if it's not already in your Dock. Paste in each command below, press return, and wait for command to complete before moving on.

## 2. Install Apple's developer tools

```bash
xcode-select --install
```

A dialog will pop up asking you to confirm. Click **Install** and let it finish — it's a few hundred megabytes. This is a one-off; if you already have it, you'll see a message saying so and can carry on.

{{< alert >}}
You do **not** need Xcode itself, which is a 10 GB download. The Command Line Tools installed above are enough.
{{< /alert >}}

## 3. Download and build the app

```bash
cd ~/Documents
git clone https://github.com/matthewtwarren/keeper.git
cd keeper
make app
```

This copies the code from my GitHub repository into a `keeper` folder in `~/Documents`, and builds the app. The installation should end with `Build complete!`, then you're good to go.

## 4. Move it into Applications

```bash
cp -R Keeper.app /Applications/
```

That's it. Keeper is now in your Applications folder and in Spotlight, like any other app. Open it, press `⌘O` to choose a folder of photos, and press `H` at any point to see the list of keyboard shortcuts.

## Updating

If I change something, you can pick up the new version by pasting this in:

```bash
cd ~/Documents/keeper
git pull
make app
rm -rf /Applications/Keeper.app
cp -R Keeper.app /Applications/
```
