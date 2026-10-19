# config/routes.rb
#
# Add these inside your existing Rails.application.routes.draw block.
# Shown as a focused diff — merge with your current routes.

Rails.application.routes.draw do
  # --- Static / marketing pages -------------------------------------------
  get "services", to: "pages#services"
  get "about",    to: "pages#about"
  get "privacy",  to: "pages#privacy"
  get "contact",  to: "pages#contact"
  post "contact", to: "pages#submit_contact" # inquiry form handler (optional)

  # --- Developer tools -----------------------------------------------------
  # Flat, SEO-friendly slug. Add future tools as sibling routes.
  get "tools",                            to: "tools#index"
  get "tools/connection-pool-calculator", to: "tools#connection_pool_calculator",
                                          as: :connection_pool_calculator

  # --- Existing blog routes (leave as-is; shown for reference) -------------
  # get "blog",       to: "blog#index"
  # get "blog/:slug", to: "blog#show", as: :blog_post
end
