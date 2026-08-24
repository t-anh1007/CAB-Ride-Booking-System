import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth.js";
import { reviewApi } from "@/services/reviewApi.js";

export function DriverReviewsRatingPage() {
  const { session } = useAuth();
  const driverId = session?.subject_id || session?.id || session?.driverId;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0, distribution: {} });
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!driverId) return;
    const fetchReviews = async () => {
      try {
        const [avgRes, reviewsRes] = await Promise.all([
          reviewApi.getDriverAverageRating(driverId).catch(() => ({ data: { averageRating: 0, totalReviews: 0 } })),
          reviewApi.getDriverReviews(driverId).catch(() => ({ data: [] }))
        ]);
        
        setStats(avgRes.data || { averageRating: 0, totalReviews: 0 });
        
        const reviewList = Array.isArray(reviewsRes.data) ? reviewsRes.data : [];
        setReviews(reviewList);
        
      } catch (err) {
        console.error("Failed to fetch reviews", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, [driverId]);

  // Compute local distribution if backend doesn't provide it
  const dist = stats.distribution || {};
  const s5 = dist['5'] || reviews.filter(r => r.rating === 5).length || 0;
  const s4 = dist['4'] || reviews.filter(r => r.rating === 4).length || 0;
  const s3 = dist['3'] || reviews.filter(r => r.rating === 3).length || 0;
  const s2 = dist['2'] || reviews.filter(r => r.rating === 2).length || 0;
  const s1 = dist['1'] || reviews.filter(r => r.rating === 1).length || 0;

  const avgRating = stats.averageRating ? stats.averageRating.toFixed(1) : "0.0";
  const numReviews = stats.totalReviews || reviews.length;

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? "★" : "☆");
    }
    return stars.join(" ");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm h-[760px] bg-white rounded-[28px] shadow-lg overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b">
          <h1 className="text-lg font-semibold text-slate-900">Đánh giá & nhận xét</h1>
          <p className="text-xs text-slate-500 mt-0.5">Driver App</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded-2xl bg-yellow-50 p-4 flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-semibold text-yellow-700">{loading ? "..." : avgRating}</p>
              <p className="text-xs text-yellow-600">/ 5.0</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-1 text-yellow-400">
                {renderStars(Math.round(stats.averageRating || 0))}
              </div>
              <p className="text-xs text-slate-500">
                {loading ? "..." : `${numReviews.toLocaleString()} lượt đánh giá`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border p-4 space-y-2 text-sm">
            {[
              ["5 sao", s5],
              ["4 sao", s4],
              ["3 sao", s3],
              ["2 sao", s2],
              ["1 sao", s1]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span>{label}</span>
                <span className="text-slate-500">{loading ? "-" : value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-900">Nhận xét gần đây</p>

            {loading ? (
              <p className="text-sm text-slate-500 text-center">Đang tải...</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">Chưa có đánh giá nào.</p>
            ) : (
              reviews.slice(0, 10).map((review) => (
                <div key={review.reviewId || review._id || review.id} className="rounded-2xl border p-4">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1 text-yellow-400 text-xs">
                      {renderStars(review.rating)}
                    </div>
                    <span className="text-xs text-slate-400">
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : "Gần đây"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{review.comment || "Không có nhận xét."}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
