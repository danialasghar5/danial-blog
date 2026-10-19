# app/controllers/tools_controller.rb
class ToolsController < ApplicationController
  def index
    @seo = {
      title: "Developer Tools — Rails & Background Jobs | Danial Asghar",
      description: "Free, client-side developer tools for Rails reliability: connection-pool " \
                   "sizing, retry backoff, and more.",
      url: "https://danialasghar.com/tools"
    }
  end

  def connection_pool_calculator
    @seo = {
      title: "Sidekiq Connection Pool Calculator — Fix Pool Exhaustion",
      description: "Free calculator: size your Rails database pool against Puma threads and " \
                   "Sidekiq concurrency. Avoid ActiveRecord::ConnectionTimeoutError and " \
                   "Postgres connection exhaustion.",
      url: "https://danialasghar.com/tools/connection-pool-calculator"
    }
  end
end
