import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, RotateCw } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { Flashcard } from "@shared/types";

interface FlashcardComponentProps {
  card: Flashcard;
  onReviewMarked?: () => void;
  documentId?: number;
}

export function FlashcardComponent({ card, onReviewMarked, documentId }: FlashcardComponentProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const utils = trpc.useUtils();
  
  const toggleFavoriteMutation = trpc.flashcards.toggleFavorite.useMutation({
    onSuccess: () => {
      toast.success(card.isFavorite ? "Removed from favorites" : "Added to favorites");
      if (documentId) {
        void utils.flashcards.list.invalidate({ documentId });
      }
    },
  });

  const markReviewedMutation = trpc.flashcards.markReviewed.useMutation({
    onSuccess: () => {
      toast.success("Flashcard marked as reviewed");
      if (documentId) {
        void utils.progress.get.invalidate({ documentId });
        void utils.flashcards.list.invalidate({ documentId });
      }
      onReviewMarked?.();
    },
  });

  return (
    <div className="space-y-3">
      {/* Flip Card */}
      <div
        className="h-56 cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 20 }}
          style={{
            transformStyle: "preserve-3d",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Front Face (Question) */}
          <Card
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-slate-50 dark:from-slate-800 dark:to-slate-950 border-2 border-emerald-200/60 dark:border-emerald-800/50 shadow-sm"
            style={{
              backfaceVisibility: "hidden",
            }}
          >
            <CardContent className="p-0 text-center">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">
                Question
              </span>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {card.question}
              </p>
            </CardContent>
          </Card>

          {/* Back Face (Answer) */}
          <Card
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white to-emerald-50 dark:from-slate-900 dark:to-slate-800 border-2 border-emerald-300 dark:border-emerald-700 shadow-md"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardContent className="p-0 text-center">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">
                Answer
              </span>
              <p className="text-xl font-semibold text-slate-900 dark:text-white leading-relaxed px-2">
                {card.answer}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-between items-center">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleFavoriteMutation.mutate({ flashcardId: card.id })}
            disabled={toggleFavoriteMutation.isPending}
            className={card.isFavorite ? "text-red-500" : ""}
          >
            <Heart
              className="w-4 h-4"
              fill={card.isFavorite ? "currentColor" : "none"}
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => markReviewedMutation.mutate({ flashcardId: card.id })}
            disabled={markReviewedMutation.isPending}
          >
            <RotateCw className="w-4 h-4 mr-1" />
            Reviewed ({card.reviewCount})
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Click to flip
        </p>
      </div>
    </div>
  );
}
