import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { BookOpen, TrendingUp, Award, Clock, Target, Flame, Calendar, BarChart3 } from "lucide-react";

export default function ProgressPage() {
  const { data: userProgress, isLoading: progressLoading } = trpc.progress.stats.useQuery();
  const { data: analytics, isLoading: analyticsLoading } = trpc.progress.analytics.useQuery();
  const { data: documents } = trpc.documents.list.useQuery();

  const isLoading = progressLoading || analyticsLoading;

  const stats = useMemo(() => {
    if (!userProgress || userProgress.length === 0) {
      return {
        totalDocuments: 0,
        totalQuizzes: 0,
        totalFlashcards: 0,
        averageScore: 0,
        totalReviews: 0,
        totalStudyTime: 0,
        currentStreak: 0,
      };
    }

    const totalQuizzes = userProgress.reduce((sum, p) => sum + (p.quizzesAttempted || 0), 0);
    const totalFlashcards = userProgress.reduce((sum, p) => sum + (p.flashcardsCreated || 0), 0);
    const totalReviews = userProgress.reduce((sum, p) => sum + (p.flashcardsReviewed || 0), 0);
    const totalStudyTime = userProgress.reduce((sum, p) => sum + (p.totalStudyTimeMinutes || 0), 0);
    
    let totalScore = 0;
    let scoreCount = 0;
    userProgress.forEach((p) => {
      if (p.averageQuizScore) {
        totalScore += parseFloat(p.averageQuizScore.toString());
        scoreCount++;
      }
    });

    return {
      totalDocuments: userProgress.length,
      totalQuizzes,
      totalFlashcards,
      averageScore: scoreCount > 0 ? totalScore / scoreCount : 0,
      totalReviews,
      totalStudyTime,
      currentStreak: analytics?.currentStreak || 0,
    };
  }, [userProgress, analytics]);

  const chartData = useMemo(() => {
    if (!userProgress || userProgress.length === 0) return [];
    
    return userProgress.map((p) => ({
      name: `Doc ${p.documentId}`,
      quizzes: p.quizzesAttempted || 0,
      flashcards: p.flashcardsReviewed || 0,
      score: p.averageQuizScore ? parseFloat(p.averageQuizScore.toString()) : 0,
    }));
  }, [userProgress]);

  if (progressLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Progress</h1>
          <p className="text-muted-foreground mt-2">
            Track your learning journey and study statistics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-3xl border-slate-100 shadow-sm group hover:border-emerald-100 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Study Time</p>
                  <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-slate-50">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-sm group hover:border-emerald-100 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Current Streak</p>
                  <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-slate-50">{stats.currentStreak}</p>
                  <p className="text-xs text-slate-400">days streak</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                  <Flame className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-sm group hover:border-emerald-100 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Quizzes Taken</p>
                  <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-slate-50">{stats.totalQuizzes}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                  <Award className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-sm group hover:border-emerald-100 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Avg Score</p>
                  <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-slate-50">{stats.averageScore.toFixed(1)}%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  <Target className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quiz and Flashcard Activity */}
            <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Study Activity by Document
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="quizzes" fill="#10b981" radius={[4, 4, 0, 0]} name="Quizzes" />
                    <Bar dataKey="flashcards" fill="#a855f7" radius={[4, 4, 0, 0]} name="Flashcards" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quiz Scores Trend */}
            <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Quiz Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      name="Avg Score (%)"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Section */}
        {analytics && (
          <div className="space-y-6">
            {/* Subject Performance */}
            {analytics.subjectPerformance && analytics.subjectPerformance.length > 0 && (
              <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                    Subject Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {analytics.subjectPerformance.map((subject, index) => (
                      <div key={subject.subject || 'Unknown'} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={`w-3 h-3 rounded-full ${
                            index === 0 ? 'bg-emerald-500' : index === analytics.subjectPerformance.length - 1 ? 'bg-slate-400' : 'bg-violet-500'
                          }`} />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{subject.subject || 'Unknown Subject'}</p>
                            <p className="text-xs text-slate-500">
                              {subject.totalQuizzes} quizzes • {subject.totalFlashcards} flashcards
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{subject.avgScore?.toFixed(1)}%</p>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">avg score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Study Activity */}
            {analytics.weeklyData && analytics.weeklyData.length > 0 && (
              <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    Weekly Study Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.weeklyData}>
                      <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="week" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Area
                        type="monotone"
                        dataKey="totalMinutes"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorMinutes)"
                        name="Study Time (min)"
                      />
                      <Area
                        type="monotone"
                        dataKey="sessionsCount"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="none"
                        name="Sessions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Monthly Study Trends */}
            {analytics.monthlyData && analytics.monthlyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Study Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalMinutes"
                        stroke="#8b5cf6"
                        name="Total Minutes"
                        strokeWidth={3}
                      />
                      <Line
                        type="monotone"
                        dataKey="sessionsCount"
                        stroke="#f59e0b"
                        name="Sessions"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recommended Revision */}
            {analytics.recommendedRevision && analytics.recommendedRevision.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommended for Revision</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Documents that need more attention based on performance and study frequency
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.recommendedRevision.slice(0, 5).map((rec) => (
                      <div key={rec.documentId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{rec.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {rec.subject || 'Unknown subject'} • {rec.quizzesAttempted} quizzes taken
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            {rec.avgScore ? `${rec.avgScore.toFixed(1)}%` : 'Not scored'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {rec.lastActivity ? new Date(rec.lastActivity).toLocaleDateString() : 'Never studied'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Document Progress Details */}
        {userProgress && userProgress.length > 0 && (
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                Progress by Document
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {userProgress.map((progress) => {
                const doc = documents?.find((d) => d.id === progress.documentId);
                const progressPercent = Math.min(
                  ((progress.quizzesAttempted || 0) + (progress.flashcardsReviewed || 0)) / 10 * 100,
                  100
                );

                return (
                  <div key={progress.documentId} className="space-y-3 p-4 rounded-2xl border border-slate-50 hover:border-emerald-50 hover:bg-emerald-50/5 transition-all">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{doc?.title || `Document ${progress.documentId}`}</p>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">
                        {Math.round(progressPercent)}%
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2 rounded-full bg-slate-100" />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{progress.quizzesAttempted || 0} quizzes • {progress.flashcardsReviewed || 0} reviewed</span>
                      {progress.averageQuizScore && (
                        <span className="font-medium text-emerald-500">
                          Avg: {parseFloat(progress.averageQuizScore.toString()).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {(!userProgress || userProgress.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No progress data yet. Upload a document and start studying to see your progress!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
