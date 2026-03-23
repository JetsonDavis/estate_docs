package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"github.com/estate-docs/go-backend/internal/config"
	"github.com/estate-docs/go-backend/internal/database"
	"github.com/estate-docs/go-backend/internal/handlers"
	"github.com/estate-docs/go-backend/internal/middleware"
	"github.com/estate-docs/go-backend/internal/services"
	"github.com/estate-docs/go-backend/internal/utils"
)

func main() {
	// Load .env file (ignore error if not found)
	godotenv.Load()

	cfg := config.Load()
	database.Connect(cfg)

	// Initialize services
	authSvc := services.NewAuthService(database.DB, cfg)
	userSvc := services.NewUserService(database.DB)
	qgSvc := services.NewQuestionGroupService(database.DB)
	qSvc := services.NewQuestionService(database.DB)
	tmplSvc := services.NewTemplateService(database.DB)
	sessSvc := services.NewSessionService(database.DB)
	docSvc := services.NewDocumentService(database.DB)
	flowSvc := services.NewFlowService(database.DB)
	personSvc := services.NewPersonService(database.DB)

	// Initialize handlers
	authH := handlers.NewAuthHandler(authSvc, cfg)
	userH := handlers.NewUserHandler(userSvc)
	qgH := handlers.NewQuestionGroupHandler(qgSvc, qSvc)
	tmplH := handlers.NewTemplateHandler(tmplSvc)
	sessH := handlers.NewSessionHandler(sessSvc)
	docH := handlers.NewDocumentHandler(docSvc)
	flowH := handlers.NewFlowHandler(flowSvc)
	peopleH := handlers.NewPeopleHandler(personSvc)

	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		utils.JSON(w, http.StatusOK, map[string]string{"status": "healthy"})
	})

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		utils.JSON(w, http.StatusOK, map[string]string{
			"message": "Estate Docs API (Go)",
			"version": "1.0.0",
		})
	})

	// FastAPI /docs compatibility endpoint for health checks
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		utils.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Auth routes (with rate limiting)
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(middleware.AuthRateLimiter.Middleware)
		r.Post("/register", authH.Register)
		r.Post("/login", authH.Login)
		r.Post("/refresh", authH.Refresh)
		r.Post("/logout", authH.Logout)
		r.Post("/forgot-password", authH.ForgotPassword)
		r.Post("/reset-password", authH.ResetPassword)

		// Authenticated auth routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg))
			r.Get("/me", authH.Me)
			r.Post("/change-password", authH.ChangePassword)
		})
	})

	// Users (admin only)
	r.Route("/api/users", func(r chi.Router) {
		r.Use(middleware.RequireAdmin(cfg))
		r.Get("/", userH.List)
		r.Post("/", userH.Create)
		r.Get("/{user_id}", userH.GetByID)
		r.Put("/{user_id}", userH.Update)
		r.Delete("/{user_id}", userH.Delete)
	})

	// Question Groups (admin only)
	r.Route("/api/question-groups", func(r chi.Router) {
		r.Use(middleware.RequireAdmin(cfg))
		r.Get("/", qgH.List)
		r.Post("/", qgH.Create)
		r.Get("/questions/check-identifier", qgH.CheckIdentifier)
		r.Get("/{group_id}", qgH.GetByID)
		r.Put("/{group_id}", qgH.Update)
		r.Delete("/{group_id}", qgH.Delete)
		r.Post("/{group_id}/copy", qgH.Copy)

		// Questions within a group
		r.Get("/{group_id}/questions", qgH.ListQuestions)
		r.Post("/{group_id}/questions", qgH.CreateQuestion)
		r.Put("/{group_id}/questions/{question_id}", qgH.UpdateQuestion)
		r.Delete("/{group_id}/questions/{question_id}", qgH.DeleteQuestion)
	})

	// Templates
	r.Route("/api/templates", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg))
			r.Get("/", tmplH.List)
			r.Get("/{template_id}", tmplH.GetByID)
			r.Get("/{template_id}/identifiers", tmplH.GetIdentifiers)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin(cfg))
			r.Post("/", tmplH.Create)
			r.Post("/upload", tmplH.Upload)
			r.Put("/{template_id}", tmplH.Update)
			r.Delete("/{template_id}", tmplH.Delete)
			r.Post("/{template_id}/duplicate", tmplH.Duplicate)
		})
	})

	// Sessions (authenticated)
	r.Route("/api/sessions", func(r chi.Router) {
		r.Use(middleware.RequireAuth(cfg))
		r.Post("/", sessH.Create)
		r.Get("/", sessH.List)
		r.Get("/{session_id}", sessH.GetByID)
		r.Delete("/{session_id}", sessH.Delete)
		r.Get("/{session_id}/questions", sessH.GetQuestions)
		r.Get("/{session_id}/progress", sessH.GetProgress)
		r.Post("/{session_id}/submit", sessH.SubmitAnswers)
		r.Post("/{session_id}/save-answers", sessH.SaveAnswers)
		r.Post("/{session_id}/delete-answers", sessH.DeleteAnswers)
		r.Post("/{session_id}/navigate", sessH.Navigate)
		r.Get("/{session_id}/identifiers", sessH.GetIdentifiers)
		r.Post("/{session_id}/copy", sessH.Copy)
		r.Get("/{session_id}/verify-persistence", sessH.VerifyPersistence)
		r.Post("/{session_id}/complete", sessH.MarkComplete)
	})

	// Documents (authenticated)
	r.Route("/api/documents", func(r chi.Router) {
		r.Use(middleware.RequireAuth(cfg))
		r.Post("/generate", docH.Generate)
		r.Get("/preview", docH.Preview)
		r.Get("/", docH.List)
		r.Get("/{document_id}", docH.GetByID)
		r.Delete("/{document_id}", docH.Delete)
		r.Post("/merge", docH.Merge)
	})

	// Flows
	r.Route("/api/flows", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(cfg))
			r.Get("/", flowH.List)
			r.Get("/{flow_id}", flowH.GetByID)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin(cfg))
			r.Post("/", flowH.Create)
			r.Put("/{flow_id}", flowH.Update)
			r.Delete("/{flow_id}", flowH.Delete)
		})
	})

	// People (admin only)
	r.Route("/api/people", func(r chi.Router) {
		r.Use(middleware.RequireAdmin(cfg))
		r.Post("/", peopleH.Create)
		r.Get("/", peopleH.List)
		r.Get("/{person_id}", peopleH.GetByID)
		r.Put("/{person_id}", peopleH.Update)
		r.Delete("/{person_id}", peopleH.Delete)
		r.Post("/{person_id}/relationships", peopleH.AddRelationship)
		r.Delete("/{person_id}/relationships/{related_person_id}", peopleH.RemoveRelationship)
		r.Get("/{person_id}/relationships", peopleH.GetRelationships)
	})

	addr := ":" + cfg.Port
	log.Printf("Starting server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
