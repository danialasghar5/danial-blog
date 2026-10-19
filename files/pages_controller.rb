# app/controllers/pages_controller.rb
class PagesController < ApplicationController
  def services
    @seo = {
      title: "Rails Reliability Consulting — Background Jobs, Sidekiq, Postgres",
      description: "Fixed-scope audits and tuning for production Rails: background-job " \
                   "reliability, Sidekiq/Solid Queue scaling, and Postgres concurrency reviews.",
      url: "https://danialasghar.com/services"
    }
  end

  def about
    @seo = {
      title: "About Danial Asghar — Senior Backend Reliability Engineer",
      description: "Senior backend engineer specializing in production Rails, PostgreSQL, " \
                   "and background-job reliability.",
      url: "https://danialasghar.com/about"
    }
  end

  def privacy; end
  def contact; end

  # Minimal inquiry handler. Wire to your mailer / CRM as needed.
  def submit_contact
    # ContactMailer.inquiry(params.permit(:name, :email, :message)).deliver_later
    redirect_to contact_path, notice: "Thanks — I'll get back to you within 1–2 business days."
  end
end
