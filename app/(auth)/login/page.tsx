"use client";

import React from "react";
import Image from "next/image";
import { Shield, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarburstBackground } from "@/components/ui/starburst-bg";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801";

export default function LoginPage() {
  const handleXLogin = () => {
    window.location.href = "/api/auth/x";
  };

  return (
    <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
      <StarburstBackground />
      <Card className="relative z-10 w-full max-w-sm border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Image
                src="/optx-logo.png"
                alt="OPTX"
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <h1 className="font-orbitron text-2xl font-bold text-primary tracking-wider mb-1">
              Jett Chat
            </h1>
            <p className="text-muted-foreground text-sm font-mono">
              End-to-end encrypted messaging
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            {/* X OAuth — Primary */}
            <Button
              onClick={handleXLogin}
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-medium gap-3 rounded-xl"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Sign in with X
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">then</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Solana Wallet — Web3 gate */}
            <Button
              variant="outline"
              className="w-full h-12 border-primary/30 text-primary hover:bg-primary/10 font-medium gap-3 rounded-xl"
              onClick={() => {
                // Wallet connect handled by Solana adapter
              }}
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet · Hold 1 JTX
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-mono">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Stripe — non-web3 fiat gate */}
            <a href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                className="w-full h-12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-medium gap-3 rounded-xl"
              >
                <CreditCard className="w-5 h-5" />
                Pay $8 — No Wallet Needed
              </Button>
            </a>

            {/* Tier upsell */}
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/60 font-mono">
                MOJO $8.88/mo
              </Badge>
              <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/60 font-mono">
                DOJO $28.88/6mo
              </Badge>
              <Badge variant="outline" className="text-[9px] border-purple-500/20 text-purple-400/60 font-mono">
                SPACE COWBOY $88.88
              </Badge>
            </div>
          </div>

          {/* E2E badge */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-[10px] text-muted-foreground font-mono">
              TKDF hybrid encryption · Post-quantum resistant
            </span>
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-muted-foreground/60 text-[10px] font-mono">
            Powered by OPTX · jettoptx.chat
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
